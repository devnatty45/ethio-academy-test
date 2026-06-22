// app/api/master/sms/resend/route.ts
// Purpose: Re-queue a failed SMS for retry
// Who can call it: MASTER_ADMIN only

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isMfaVerifiedInSession } from "@/lib/supabase/session"
import { writeAuditLog } from "@/lib/utils/audit"

const resendSchema = z.object({
  smsIds: z.array(z.string().uuid()).min(1).max(100),
})

export async function POST(request: NextRequest) {
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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const parsed = resendSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { smsIds } = parsed.data

  // Reset these records to PENDING with retry_count = 0
  const { error: updateError, count } = await adminClient
    .from("sms_queue")
    .update({
      status: "PENDING",
      retry_count: 0,
      last_attempted_at: null,
    })
    .in("id", smsIds)
    .eq("status", "FAILED")

  if (updateError) {
    console.error("[SmsResend] Update error:", updateError)
    return NextResponse.json(
      { error: "Could not re-queue messages" },
      { status: 500 }
    )
  }

  await writeAuditLog({
    actorId: user.id,
    actorRole: "MASTER_ADMIN",
    actionType: "SMS_RESEND_QUEUED",
    targetTable: "sms_queue",
    targetId: undefined,
    newValue: { smsIds, count },
  })

  return NextResponse.json({
    success: true,
    requeued: count ?? smsIds.length,
  })
}