// app/api/admin/branch/payment-claims/[claimId]/reject/route.ts
// Purpose: Reject a manual payment claim
// Who can call it: BRANCH_ADMIN for own branch, MASTER_ADMIN for any

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isMfaVerifiedInSession } from "@/lib/supabase/session"
import { writeAuditLog } from "@/lib/utils/audit"
import { queueSms } from "@/lib/utils/sms"

const paramsSchema = z.object({ claimId: z.string().uuid() })
const rejectSchema = z.object({
  rejectionReason: z.string().min(5).max(500),
})

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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const parsed = rejectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { rejectionReason } = parsed.data

  const { data: claim } = await adminClient
    .from("manual_payment_claims")
    .select("id, status, branch_id, guardian_id, enrollment_id")
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

  // --- FIXED: REMOVED THE NON-EXISTENT reviewed_at FIELD & ADDED SAFE ERROR INTERCEPTOR ---
  const { error: claimUpdateError } = await adminClient
    .from("manual_payment_claims")
    .update({
      status: "REJECTED",
      reviewed_by: user.id,
      updated_at: new Date().toISOString(),
      rejection_reason: rejectionReason,
    })
    .eq("id", claimId)

  if (claimUpdateError) {
    console.error(
      "[ManualClaimReject] claim status update error:",
      claimUpdateError
    )
    return NextResponse.json(
      { error: "Could not update claim status" },
      { status: 500 }
    )
  }

  await writeAuditLog({
    actorId: user.id,
    actorRole: userData.role,
    actionType: "MANUAL_PAYMENT_CLAIM_REJECTED",
    targetTable: "manual_payment_claims",
    targetId: claimId,
    newValue: { rejection_reason: rejectionReason },
  })

  const { data: guardianProfile } = await adminClient
    .from("guardian_profiles")
    .select("phone")
    .eq("user_id", claim.guardian_id)
    .single()

  if (guardianProfile?.phone) {
    await queueSms({
      recipientPhone: guardianProfile.phone,
      messageBody: `Your payment claim could not be verified — ${rejectionReason}. Please submit a new claim or pay via Chapa.`,
      triggerEvent: "MANUAL_PAYMENT_REJECTED",
      relatedId: claim.enrollment_id,
    })
  }

  return NextResponse.json({ success: true })
}