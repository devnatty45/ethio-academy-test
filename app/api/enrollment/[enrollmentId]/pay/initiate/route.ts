// app/api/enrollment/[enrollmentId]/pay/initiate/route.ts
// Purpose: Generate a Chapa checkout session for a PAYMENT_PENDING enrollment
// Who can call it: guardian who owns this enrollment

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { initializeChapaPayment } from "@/lib/chapa/server"
import { writeAuditLog } from "@/lib/utils/audit"
import crypto from "crypto"

const paramsSchema = z.object({ enrollmentId: z.string().uuid() })

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
    .select("role, email, full_name")
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

  const { data: enrollment } = await adminClient
    .from("enrollments")
    .select(
      "id, status, guardian_id, fee_structure_id, payment_deadline_at, student_id"
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
        error: `Cannot pay — enrollment is in ${enrollment.status} status`,
      },
      { status: 409 }
    )
  }

  if (
    enrollment.payment_deadline_at &&
    new Date(enrollment.payment_deadline_at) < new Date()
  ) {
    return NextResponse.json(
      {
        error:
          "The payment deadline has passed. This enrollment may have expired.",
      },
      { status: 410 }
    )
  }

  if (!enrollment.fee_structure_id) {
    return NextResponse.json(
      { error: "No fee structure linked to this enrollment" },
      { status: 409 }
    )
  }

  const { data: feeStructure } = await adminClient
    .from("fee_structures")
    .select("total_amount")
    .eq("id", enrollment.fee_structure_id)
    .single()

  if (!feeStructure) {
    return NextResponse.json(
      { error: "Fee structure not found" },
      { status: 404 }
    )
  }

  const { data: guardianProfile } = await adminClient
    .from("guardian_profiles")
    .select("phone")
    .eq("user_id", user.id)
    .single()

  // Check for an existing PENDING payment for this enrollment — reuse it
  const { data: existingPayment } = await adminClient
    .from("payments")
    .select("id, tx_ref, status")
    .eq("enrollment_id", enrollmentId)
    .eq("status", "PENDING")
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  const txRef =
    existingPayment?.tx_ref ??
    `ENR-${enrollmentId.slice(0, 8)}-${crypto
      .randomBytes(4)
      .toString("hex")}`

  // NOTE: In local development, set NEXT_PUBLIC_APP_URL to your
  // ngrok URL so Chapa can reach the webhook endpoint.
  // In production this resolves to the real deployed domain.
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  const result = await initializeChapaPayment({
    amount: feeStructure.total_amount,
    currency: "ETB",
    email: userData.email,
    firstName: userData.full_name?.split(" ")[0] ?? "Guardian",
    lastName:
      userData.full_name?.split(" ").slice(1).join(" ") || "User",
    phoneNumber: guardianProfile?.phone ?? "0900000000",
    txRef,
    callbackUrl: ` https://2b8c-196-189-120-166.ngrok-free.app/api/payments/webhook`,
    returnUrl: `${appUrl}/dashboard/guardian/enrollments/${enrollmentId}/pay/result`,
  })

  if (!result.success || !result.checkoutUrl) {
    const outputErrorMessage =
      typeof result.error === "object" && result.error !== null
        ? ((result.error as { message?: string }).message ??
          "Chapa provider integration error")
        : (result.error as string | null) ?? "Could not initiate payment"

    return NextResponse.json(
      { error: outputErrorMessage },
      { status: 502 }
    )
  }

  if (existingPayment) {
    const { error: updateErr } = await adminClient
      .from("payments")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", existingPayment.id)

    if (updateErr) {
      console.error("[PayInitiate] payment update error:", updateErr)
      return NextResponse.json(
        { error: "Could not update payment record" },
        { status: 500 }
      )
    }
  } else {
    const { error: insertErr } = await adminClient
      .from("payments")
      .insert({
        enrollment_id: enrollmentId,
        guardian_id: user.id,
        tx_ref: txRef,
        amount: feeStructure.total_amount,
        currency: "ETB",
        status: "PENDING",
        source: "CHAPA",
      })

    if (insertErr) {
      console.error("[PayInitiate] payment insert error:", insertErr)
      return NextResponse.json(
        { error: "Could not create payment record" },
        { status: 500 }
      )
    }
  }

  await writeAuditLog({
    actorId: user.id,
    actorRole: "GUARDIAN",
    actionType: "PAYMENT_INITIATED",
    targetTable: "payments",
    targetId: enrollmentId,
    newValue: { tx_ref: txRef, amount: feeStructure.total_amount },
  })

  return NextResponse.json({
    success: true,
    checkoutUrl: result.checkoutUrl,
    txRef,
  })
}