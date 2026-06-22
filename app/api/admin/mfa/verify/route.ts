// app/api/admin/mfa/verify/route.ts
// Purpose: Verify TOTP code on every admin login
// Who can call it: authenticated BRANCH_ADMIN or MASTER_ADMIN only
// POST: verify code → set session cookie → return success
// Also handles backup code verification

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { verifyTotpCode, verifyBackupCode } from "@/lib/utils/totp"
import { setMfaVerifiedCookie } from "@/lib/supabase/session"
import { writeAuditLog } from "@/lib/utils/audit"

const verifySchema = z.object({
  code: z.string().min(6).max(10),
  isBackupCode: z.boolean().default(false),
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
    .select("role, email")
    .eq("id", user.id)
    .single()

  if (
    !userData ||
    !["BRANCH_ADMIN", "MASTER_ADMIN"].includes(userData.role)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const result = verifySchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { code, isBackupCode } = result.data

  // Fetch MFA record
  const { data: mfaRecord } = await adminClient
    .from("admin_mfa")
    .select(
      "totp_secret_encrypted, backup_codes_hashed, failed_attempts, locked_until, is_configured"
    )
    .eq("admin_id", user.id)
    .single()

  if (!mfaRecord?.is_configured) {
    return NextResponse.json(
      { error: "MFA not configured" },
      { status: 400 }
    )
  }

  // Check if account is locked
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
    // Lock expired — clear it
    await adminClient
      .from("admin_mfa")
      .update({ locked_until: null, failed_attempts: 0 })
      .eq("admin_id", user.id)
  }

  let verified = false
  let requiresMfaResetup = false

  if (isBackupCode) {
    const hashedCodes = mfaRecord.backup_codes_hashed as string[]

    // Check if all codes are already exhausted
    const allExhausted = hashedCodes.every((c) => c === "USED")
    if (allExhausted) {
      return NextResponse.json(
        {
          error: "All backup codes have been used. Contact your administrator.",
          allCodesExhausted: true,
        },
        { status: 400 }
      )
    }

    const matchIndex = verifyBackupCode(code, hashedCodes)

    if (matchIndex !== -1) {
      const updatedCodes = [...hashedCodes]
      updatedCodes[matchIndex] = "USED"

      await adminClient
        .from("admin_mfa")
        .update({
          backup_codes_hashed: updatedCodes,
          last_verified_at: new Date().toISOString(),
          failed_attempts: 0,
          locked_until: null,
        })
        .eq("admin_id", user.id)

      verified = true
      requiresMfaResetup = true

      await writeAuditLog({
        actorId: user.id,
        actorRole: userData.role,
        actionType: "MFA_BACKUP_CODE_USED",
        targetTable: "admin_mfa",
        targetId: user.id,
        newValue: { backup_code_index: matchIndex },
      })
    }
  } else {
    // TOTP code verification
    verified = await verifyTotpCode(
      code,
      mfaRecord.totp_secret_encrypted
    )

    if (verified) {
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
        actorRole: userData.role,
        actionType: "MFA_VERIFIED",
        targetTable: "admin_mfa",
        targetId: user.id,
      })
    }
  }

  if (!verified) {
    // Increment failed attempts
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

    await writeAuditLog({
      actorId: user.id,
      actorRole: userData.role,
      actionType: "MFA_FAILED_ATTEMPT",
      targetTable: "admin_mfa",
      targetId: user.id,
      newValue: {
        failed_attempts: newFailedAttempts,
        locked: shouldLock,
      },
    })

    if (shouldLock) {
      return NextResponse.json(
        {
          error: "Too many failed attempts. Account locked for 30 minutes.",
          locked: true,
          minutesLeft: 30,
        },
        { status: 423 }
      )
    }

    const attemptsLeft = 3 - newFailedAttempts
    return NextResponse.json(
      {
        error: `Invalid code. ${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} remaining.`,
      },
      { status: 400 }
    )
  }

  // Verification successful — set session cookie
  await setMfaVerifiedCookie(user.id)

  return NextResponse.json({
    success: true,
    requiresMfaResetup,
  })
}