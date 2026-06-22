// app/api/master/recovery-requests/[requestId]/reject/route.ts
// Purpose: Reject a guardian recovery request with a reason
// Who can call it: MASTER_ADMIN only

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isMfaVerifiedInSession } from "@/lib/supabase/session"
import { writeAuditLog } from "@/lib/utils/audit"
import { queueSms } from "@/lib/utils/sms"

const paramsSchema = z.object({ requestId: z.string().uuid() })
const rejectSchema = z.object({
  rejectionReason: z.string().min(10).max(500),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
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

  const { requestId } = paramsResult.data

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

  const { data: recoveryRequest } = await adminClient
    .from("guardian_recovery_requests")
    .select(
      "id, status, new_guardian_id, claimed_phone"
    )
    .eq("id", requestId)
    .single()

  if (!recoveryRequest) {
    return NextResponse.json(
      { error: "Request not found" },
      { status: 404 }
    )
  }

  if (recoveryRequest.status !== "PENDING") {
    return NextResponse.json(
      {
        error: `Cannot reject — request is already ${recoveryRequest.status}`,
      },
      { status: 409 }
    )
  }

  await adminClient
    .from("guardian_recovery_requests")
    .update({
      status: "REJECTED",
      reviewed_by: user.id,
      rejection_reason: rejectionReason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)

  await writeAuditLog({
    actorId: user.id,
    actorRole: "MASTER_ADMIN",
    actionType: "RECOVERY_REQUEST_REJECTED",
    targetTable: "guardian_recovery_requests",
    targetId: requestId,
    oldValue: { status: "PENDING" },
    newValue: { status: "REJECTED", rejection_reason: rejectionReason },
  })

  const { data: newGuardianProfile } = await adminClient
    .from("guardian_profiles")
    .select("phone")
    .eq("user_id", recoveryRequest.new_guardian_id)
    .single()

  const smsPhone =
    newGuardianProfile?.phone ?? recoveryRequest.claimed_phone

  if (smsPhone) {
    await queueSms({
      recipientPhone: smsPhone,
      messageBody: `Your account recovery request could not be approved — ${rejectionReason}. Please contact the school for assistance.`,
      triggerEvent: "RECOVERY_REJECTED",
      relatedId: requestId,
    })
  }

  return NextResponse.json({ success: true })
}