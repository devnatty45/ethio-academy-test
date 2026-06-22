// app/api/master/mfa/reverify/route.ts
// Purpose: Re-verify TOTP for sensitive Master Admin actions
// Who can call it: authenticated MASTER_ADMIN with MFA verified in session
// POST: verify current TOTP code → set 15-minute action cookie

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { verifyTotpCode } from "@/lib/utils/totp"
import {
  isMfaVerifiedInSession,
  setSensitiveActionVerifiedCookie,
} from "@/lib/supabase/session"
import { writeAuditLog } from "@/lib/utils/audit"

const reVerifySchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/),
  actionDescription: z.string().min(1).max(200),
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

  // Must have MFA verified in session to attempt re-verification
  const sessionVerified = await isMfaVerifiedInSession(user.id)
  if (!sessionVerified) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const result = reVerifySchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { code, actionDescription } = result.data

  // Fetch MFA record
  const { data: mfaRecord } = await adminClient
    .from("admin_mfa")
    .select("totp_secret_encrypted, is_configured, failed_attempts, locked_until")
    .eq("admin_id", user.id)
    .single()

  if (!mfaRecord?.is_configured) {
    return NextResponse.json({ error: "MFA not configured" }, { status: 400 })
  }

  // Check lockout
  if (mfaRecord.locked_until) {
    const lockedUntil = new Date(mfaRecord.locked_until)
    if (lockedUntil > new Date()) {
      const minutesLeft = Math.ceil(
        (lockedUntil.getTime() - Date.now()) / 60000
      )
      return NextResponse.json(
        {
          error: `Account locked. Try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.`,
          locked: true,
          minutesLeft,
        },
        { status: 423 }
      )
    }
    await adminClient
      .from("admin_mfa")
      .update({ locked_until: null, failed_attempts: 0 })
      .eq("admin_id", user.id)
  }

  const verified = await verifyTotpCode(
    code,
    mfaRecord.totp_secret_encrypted
  )

  if (!verified) {
    const newFailedAttempts = (mfaRecord.failed_attempts ?? 0) + 1
    const shouldLock = newFailedAttempts >= 3

    await adminClient
      .from("admin_mfa")
      .update({
        failed_attempts: newFailedAttempts,
        locked_until: shouldLock
          ? new Date(Date.now() + 30 * 60 * 1000).toISOString()
          : null,
      })
      .eq("admin_id", user.id)

    const attemptsLeft = 3 - newFailedAttempts
    return NextResponse.json(
      {
        error: shouldLock
          ? "Too many failed attempts. Account locked for 30 minutes."
          : `Invalid code. ${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} remaining.`,
        locked: shouldLock,
      },
      { status: shouldLock ? 423 : 400 }
    )
  }

  // Verified — set 15-minute action cookie
  await setSensitiveActionVerifiedCookie(user.id)

  await adminClient
    .from("admin_mfa")
    .update({
      last_verified_at: new Date().toISOString(),
      failed_attempts: 0,
      locked_until: null,
    })
    .eq("admin_id", user.id)

  await writeAuditLog({
    actorId: user.id,
    actorRole: "MASTER_ADMIN",
    actionType: "SENSITIVE_ACTION_REVERIFIED",
    newValue: { action_description: actionDescription },
  })

  return NextResponse.json({ success: true })
}