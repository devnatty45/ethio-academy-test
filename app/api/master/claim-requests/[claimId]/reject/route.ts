// app/api/master/claim-requests/[claimId]/reject/route.ts
// Purpose: Reject a student claim request with a reason
// Who can call it: MASTER_ADMIN only

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isMfaVerifiedInSession } from "@/lib/supabase/session"
import { writeAuditLog } from "@/lib/utils/audit"
import { queueSms } from "@/lib/utils/sms"

const paramsSchema = z.object({ claimId: z.string().uuid() })
const rejectSchema = z.object({
  rejectionReason: z.string().min(10).max(500),
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

  if (!userData || userData.role !== "MASTER_ADMIN") {
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

  const { data: claim, error: claimError } = await adminClient
    .from("claim_requests")
    .select(
      "id, status, claimed_guardian_id, matched_student_id"
    )
    .eq("id", claimId)
    .single()

  if (claimError || !claim) {
    return NextResponse.json(
      { error: "Claim not found" },
      { status: 404 }
    )
  }

  if (claim.status !== "PENDING") {
    return NextResponse.json(
      {
        error: `Cannot reject — claim is already ${claim.status}`,
      },
      { status: 409 }
    )
  }

  const { error: updateError } = await adminClient
    .from("claim_requests")
    .update({
      status: "REJECTED",
      reviewed_by: user.id,
      rejection_reason: rejectionReason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", claimId)

  if (updateError) {
    console.error("[ClaimReject] Update error:", updateError)
    return NextResponse.json(
      { error: "Could not update claim status" },
      { status: 500 }
    )
  }

  await writeAuditLog({
    actorId: user.id,
    actorRole: "MASTER_ADMIN",
    actionType: "CLAIM_REQUEST_REJECTED",
    targetTable: "claim_requests",
    targetId: claimId,
    oldValue: { status: "PENDING" },
    newValue: {
      status: "REJECTED",
      rejection_reason: rejectionReason,
    },
  })

  const { data: guardianProfile } = await adminClient
    .from("guardian_profiles")
    .select("phone")
    .eq("user_id", claim.claimed_guardian_id)
    .single()

  if (guardianProfile?.phone) {
    await queueSms({
      recipientPhone: guardianProfile.phone,
      messageBody: `Your student claim request could not be approved — ${rejectionReason}. Please contact the school for assistance.`,
      triggerEvent: "CLAIM_REJECTED",
      relatedId: claimId,
    })
  }

  return NextResponse.json({ success: true })
}