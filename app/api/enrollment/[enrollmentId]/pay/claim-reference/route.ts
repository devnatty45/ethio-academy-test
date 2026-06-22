// app/api/enrollment/[enrollmentId]/pay/claim-reference/route.ts
// Purpose: Guardian submits their Chapa merchant reference when payment
//          confirmed on Chapa side but enrollment still PAYMENT_PENDING
// Who can call it: guardian who owns this PAYMENT_PENDING enrollment
// Rate limited: 3 attempts per enrollment per hour

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { verifyChapaTransaction } from "@/lib/chapa/server"
import { writeAuditLog } from "@/lib/utils/audit"
import { queueSms } from "@/lib/utils/sms"
import { Redis } from "@upstash/redis"

const paramsSchema = z.object({ enrollmentId: z.string().uuid() })

const claimSchema = z.object({
  merchantReference: z
    .string()
    .min(5)
    .max(100)
    .regex(/^[A-Za-z0-9\-]+$/, "Invalid reference format"),
})

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const adminClient = createAdminClient()
  const { data: userData } = await adminClient
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!userData || userData.role !== "GUARDIAN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const resolvedParams = await params
  const paramsResult = paramsSchema.safeParse(resolvedParams)
  if (!paramsResult.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { enrollmentId } = paramsResult.data

  // Rate limit: 3 attempts per enrollment per hour
  const rateLimitKey = `chapa_ref_claim:${enrollmentId}`
  const attempts = await redis.incr(rateLimitKey)
  if (attempts === 1) {
    await redis.expire(rateLimitKey, 3600)
  }
  if (attempts > 3) {
    const ttl = await redis.ttl(rateLimitKey)
    const minutesLeft = Math.ceil(ttl / 60)
    return NextResponse.json(
      {
        error: `Too many attempts. Try again in ${minutesLeft} minutes.`,
      },
      { status: 429 }
    )
  }

  const { data: enrollment } = await adminClient
    .from("enrollments")
    .select(
      "id, status, guardian_id, branch_id, grade_id, stream_id, academic_year_id, fee_structure_id"
    )
    .eq("id", enrollmentId)
    .eq("guardian_id", user.id)
    .single()

  if (!enrollment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (enrollment.status !== "PAYMENT_PENDING") {
    return NextResponse.json(
      {
        error: `Cannot claim — enrollment is in ${enrollment.status} status`,
      },
      { status: 409 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const parsed = claimSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid merchant reference format" },
      { status: 400 }
    )
  }

  const { merchantReference } = parsed.data

  // Look up payment by tx_ref (merchant reference) — Chapa's verify
  // endpoint only accepts the merchant tx_ref, not Chapa's own ref ID
  const { data: existingPayment } = await adminClient
    .from("payments")
    .select("id, enrollment_id, status, tx_ref")
    .eq("tx_ref", merchantReference)
    .single()

  if (existingPayment) {
    if (existingPayment.enrollment_id !== enrollmentId) {
      return NextResponse.json(
        { error: "This reference belongs to a different enrollment" },
        { status: 409 }
      )
    }
    if (existingPayment.status === "CONFIRMED") {
      return NextResponse.json(
        { error: "This payment is already confirmed" },
        { status: 409 }
      )
    }
  }

  // Verify against Chapa's API using the merchant tx_ref
  const verification = await verifyChapaTransaction(merchantReference)

  // Log the claim attempt regardless of outcome
  await adminClient.from("chapa_reference_claims").insert({
    enrollment_id: enrollmentId,
    guardian_id: user.id,
    submitted_reference: merchantReference,
    verification_status:
      verification.success && verification.status === "success"
        ? "VERIFIED"
        : "FAILED",
    chapa_response_status: verification.status,
    chapa_response_amount: verification.amount,
  })

  if (!verification.success || verification.status !== "success") {
    await writeAuditLog({
      actorId: user.id,
      actorRole: "GUARDIAN",
      actionType: "CHAPA_REFERENCE_CLAIM_FAILED",
      targetTable: "enrollments",
      targetId: enrollmentId,
      newValue: {
        submitted_reference: merchantReference,
        chapa_status: verification.status,
        error: verification.error,
      },
    })

    return NextResponse.json(
      {
        error:
          "We could not verify this reference with Chapa. Please check the reference and try again, or contact support.",
        chapaStatus: verification.status,
      },
      { status: 422 }
    )
  }

  // Verify amount matches expected fee
  const { data: feeStructure } = await adminClient
    .from("fee_structures")
    .select("total_amount")
    .eq("id", enrollment.fee_structure_id)
    .single()

  if (
    feeStructure &&
    verification.amount !== null &&
    Math.abs(verification.amount - feeStructure.total_amount) > 0.01
  ) {
    await writeAuditLog({
      actorId: user.id,
      actorRole: "GUARDIAN",
      actionType: "CHAPA_REFERENCE_CLAIM_AMOUNT_MISMATCH",
      targetTable: "enrollments",
      targetId: enrollmentId,
      newValue: {
        submitted_reference: merchantReference,
        expected_amount: feeStructure.total_amount,
        verified_amount: verification.amount,
      },
    })

    return NextResponse.json(
      {
        error:
          "The verified payment amount does not match your enrollment fee. Please contact the school.",
        expectedAmount: feeStructure.total_amount,
        verifiedAmount: verification.amount,
      },
      { status: 422 }
    )
  }

  // All checks passed — confirm the enrollment
  if (existingPayment) {
    await adminClient
      .from("payments")
      .update({
        status: "CONFIRMED",
        chapa_reference: verification.chapaReference,
        confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingPayment.id)
  } else {
    // No existing payment row for this tx_ref — create one
    await adminClient.from("payments").insert({
      enrollment_id: enrollmentId,
      guardian_id: user.id,
      tx_ref: merchantReference,
      amount: verification.amount ?? feeStructure?.total_amount,
      currency: "ETB",
      status: "CONFIRMED",
      source: "CHAPA",
      chapa_reference: verification.chapaReference,
      confirmed_at: new Date().toISOString(),
    })
  }

  // Atomically move seat: reserved → enrolled
  await adminClient.rpc("confirm_enrolled_seat", {
    p_academic_year_id: enrollment.academic_year_id,
    p_branch_id: enrollment.branch_id,
    p_grade_id: enrollment.grade_id,
    p_stream_id: enrollment.stream_id,
  })

  await adminClient
    .from("enrollments")
    .update({
      status: "ENROLLED",
      updated_at: new Date().toISOString(),
    })
    .eq("id", enrollmentId)

  await adminClient.from("enrollment_transitions").insert({
    enrollment_id: enrollmentId,
    from_status: "PAYMENT_PENDING",
    to_status: "ENROLLED",
    actor_id: user.id,
    actor_role: "GUARDIAN",
    reason: "Payment confirmed via merchant reference claim",
    metadata: {
      submitted_reference: merchantReference,
      chapa_reference: verification.chapaReference,
      amount: verification.amount,
    },
  })

  await adminClient.rpc("increment_billing_counter", {
    p_academic_year_id: enrollment.academic_year_id,
  })

  await writeAuditLog({
    actorId: user.id,
    actorRole: "GUARDIAN",
    actionType: "CHAPA_REFERENCE_CLAIM_CONFIRMED",
    targetTable: "enrollments",
    targetId: enrollmentId,
    newValue: {
      submitted_reference: merchantReference,
      chapa_reference: verification.chapaReference,
      amount: verification.amount,
    },
  })

  const { data: guardianProfile } = await adminClient
    .from("guardian_profiles")
    .select("phone")
    .eq("user_id", user.id)
    .single()

  if (guardianProfile?.phone) {
    await queueSms({
      recipientPhone: guardianProfile.phone,
      messageBody:
        "Your payment reference has been verified. Your child is now officially enrolled.",
      triggerEvent: "PAYMENT_CONFIRMED",
      relatedId: enrollmentId,
    })
  }

  return NextResponse.json({
    success: true,
    status: "ENROLLED",
    message: "Payment verified and enrollment confirmed.",
  })
}