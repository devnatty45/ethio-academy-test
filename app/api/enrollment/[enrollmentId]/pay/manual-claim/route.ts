// app/api/enrollment/[enrollmentId]/pay/manual-claim/route.ts
// Purpose: Guardian submits proof of manual payment (bank transfer/cash)
// Who can call it: guardian who owns this PAYMENT_PENDING enrollment

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { writeAuditLog } from "@/lib/utils/audit"

const paramsSchema = z.object({ enrollmentId: z.string().uuid() })

const claimSchema = z.object({
  amountPaid: z.number().positive(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentMethod: z.enum(["BANK_TRANSFER", "CASH"]),
  referenceNumber: z.string().max(200).optional(),
  proofDocumentPublicId: z.string().min(1).max(500),
  notes: z.string().max(500).optional(),
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

  const { data: enrollment } = await adminClient
    .from("enrollments")
    .select(
      "id, status, guardian_id, branch_id, fee_structure_id, payment_deadline_at"
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
        error: `Cannot submit payment claim — enrollment is in ${enrollment.status} status`,
      },
      { status: 409 }
    )
  }

  if (
    enrollment.payment_deadline_at &&
    new Date(enrollment.payment_deadline_at) < new Date()
  ) {
    return NextResponse.json(
      { error: "The payment deadline has passed" },
      { status: 410 }
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
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const {
    amountPaid,
    paymentDate,
    paymentMethod,
    referenceNumber,
    proofDocumentPublicId,
    notes,
  } = parsed.data

  // Check for an existing PENDING claim for this enrollment
  const { data: existingClaim } = await adminClient
    .from("manual_payment_claims")
    .select("id, status")
    .eq("enrollment_id", enrollmentId)
    .eq("status", "PENDING")
    .single()

  if (existingClaim) {
    return NextResponse.json(
      {
        error:
          "A payment claim is already pending review for this enrollment",
      },
      { status: 409 }
    )
  }

  const { data: newClaim, error: insertError } = await adminClient
    .from("manual_payment_claims")
    .insert({
      enrollment_id: enrollmentId,
      guardian_id: user.id,
      branch_id: enrollment.branch_id,
      amount_paid: amountPaid,
      payment_date: paymentDate,
      payment_method: paymentMethod,
      reference_number: referenceNumber ?? null,
      proof_document_public_id: proofDocumentPublicId,
      notes: notes ?? null,
      status: "PENDING",
    })
    .select("id")
    .single()

  if (insertError || !newClaim) {
    return NextResponse.json(
      { error: "Could not submit payment claim" },
      { status: 500 }
    )
  }

  await writeAuditLog({
    actorId: user.id,
    actorRole: "GUARDIAN",
    actionType: "MANUAL_PAYMENT_CLAIM_SUBMITTED",
    targetTable: "manual_payment_claims",
    targetId: newClaim.id,
    newValue: {
      enrollment_id: enrollmentId,
      amount_paid: amountPaid,
      payment_method: paymentMethod,
    },
  })

  return NextResponse.json({
    success: true,
    claimId: newClaim.id,
    message:
      "Your payment claim has been submitted for review. You will be notified once it is processed.",
  })
}