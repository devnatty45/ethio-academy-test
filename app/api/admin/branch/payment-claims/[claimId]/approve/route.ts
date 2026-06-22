// app/api/admin/branch/payment-claims/[claimId]/approve/route.ts
// Purpose: Approve a manual payment claim — confirms payment, enrolls student
// Who can call it: BRANCH_ADMIN for own branch, MASTER_ADMIN for any

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isMfaVerifiedInSession } from "@/lib/supabase/session"
import { writeAuditLog } from "@/lib/utils/audit"
import { queueSms } from "@/lib/utils/sms"

const paramsSchema = z.object({ claimId: z.string().uuid() })

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ claimId: string }> }
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

  if (
    !userData ||
    !["BRANCH_ADMIN", "MASTER_ADMIN"].includes(userData.role)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const mfaVerified = await isMfaVerifiedInSession(user.id)
  if (!mfaVerified) {
    return NextResponse.json(
      { error: "MFA verification required" },
      { status: 403 }
    )
  }

  const resolvedParams = await params
  const paramsResult = paramsSchema.safeParse(resolvedParams)
  if (!paramsResult.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { claimId } = paramsResult.data

  const { data: claim } = await adminClient
    .from("manual_payment_claims")
    .select(
      "id, status, enrollment_id, branch_id, guardian_id, amount_paid"
    )
    .eq("id", claimId)
    .single()

  if (!claim) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 })
  }

  if (userData.role === "BRANCH_ADMIN") {
    const { data: adminProfile } = await adminClient
      .from("admin_profiles")
      .select("assigned_branch_id")
      .eq("user_id", user.id)
      .single()

    if (adminProfile?.assigned_branch_id !== claim.branch_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  if (claim.status !== "PENDING") {
    return NextResponse.json(
      { error: `Claim is already ${claim.status}` },
      { status: 409 }
    )
  }

  const { data: enrollment } = await adminClient
    .from("enrollments")
    .select(
      "id, status, branch_id, grade_id, stream_id, academic_year_id, fee_structure_id"
    )
    .eq("id", claim.enrollment_id)
    .single()

  if (!enrollment) {
    return NextResponse.json(
      { error: "Enrollment not found" },
      { status: 404 }
    )
  }

  if (enrollment.status !== "PAYMENT_PENDING") {
    return NextResponse.json(
      {
        error: `Cannot approve — enrollment is in ${enrollment.status} status`,
      },
      { status: 409 }
    )
  }

  // Verify amount matches fee structure (with small tolerance)
  const { data: feeStructure } = await adminClient
    .from("fee_structures")
    .select("total_amount")
    .eq("id", enrollment.fee_structure_id)
    .single()

  if (
    feeStructure &&
    Math.abs(feeStructure.total_amount - claim.amount_paid) > 0.01
  ) {
    return NextResponse.json(
      {
        error: `Amount mismatch — claimed ${claim.amount_paid} but fee is ${feeStructure.total_amount}. Reject this claim or contact Master Admin.`,
      },
      { status: 409 }
    )
  }

  // Create a confirmed payments record for audit consistency
  const { error: paymentInsertError } = await adminClient
    .from("payments")
    .insert({
      enrollment_id: enrollment.id,
      guardian_id: claim.guardian_id,
      tx_ref: `MANUAL-${claimId.slice(0, 8)}`,
      amount: claim.amount_paid,
      currency: "ETB",
      status: "CONFIRMED",
      source: "MANUAL_ADMIN_OVERRIDE",
      override_reason: "Manual payment claim approved",
      override_by: user.id,
      confirmed_at: new Date().toISOString(),
    })

  if (paymentInsertError) {
    console.error(
      "[ManualClaimApprove] payment insert error:",
      paymentInsertError
    )
    return NextResponse.json(
      { error: "Could not create payment record" },
      { status: 500 }
    )
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
    .update({ status: "ENROLLED", updated_at: new Date().toISOString() })
    .eq("id", enrollment.id)

  // --- FIXED: UPDATE TO VERIFIED STATUS AND REMOVE NON-EXISTENT TIMESTAMPS ---
  const { error: claimUpdateError } = await adminClient
    .from("manual_payment_claims")
    .update({
      status: "VERIFIED",
      reviewed_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", claimId)

  if (claimUpdateError) {
    console.error(
      "[ManualClaimApprove] claim status update error:",
      claimUpdateError
    )
    return NextResponse.json(
      { error: "Payment confirmed but could not update claim status. Contact support." },
      { status: 500 }
    )
  }

  await adminClient.from("enrollment_transitions").insert({
    enrollment_id: enrollment.id,
    from_status: "PAYMENT_PENDING",
    to_status: "ENROLLED",
    actor_id: user.id,
    actor_role: userData.role,
    reason: "Manual payment claim approved",
    metadata: { claim_id: claimId, amount: claim.amount_paid },
  })

  await adminClient.rpc("increment_billing_counter", {
    p_academic_year_id: enrollment.academic_year_id,
  })

  await writeAuditLog({
    actorId: user.id,
    actorRole: userData.role,
    actionType: "MANUAL_PAYMENT_CLAIM_APPROVED",
    targetTable: "manual_payment_claims",
    targetId: claimId,
    newValue: { enrollment_id: enrollment.id, amount: claim.amount_paid },
  })

  const { data: guardianProfile } = await adminClient
    .from("guardian_profiles")
    .select("phone")
    .eq("user_id", claim.guardian_id)
    .single()

  if (guardianProfile?.phone) {
    await queueSms({
      recipientPhone: guardianProfile.phone,
      messageBody:
        "Your payment has been confirmed. Your child is now officially enrolled.",
      triggerEvent: "MANUAL_PAYMENT_APPROVED",
      relatedId: enrollment.id,
    })
  }

  return NextResponse.json({ success: true })
}