// app/api/admin/mfa/setup/route.ts
// Purpose: Generate TOTP secret and QR code for MFA setup
// Who can call it: authenticated BRANCH_ADMIN or MASTER_ADMIN only
// GET: returns QR code — works for first-time setup AND re-setup after backup code
// POST: verifies the code, stores encrypted secret, generates backup codes

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  generateTotpSecret,
  encryptTotpSecret,
  verifyTotpCode,
  generateQrCodeDataUrl,
  generateBackupCodes,
} from "@/lib/utils/totp"
import {
  setMfaVerifiedCookie,
  isMfaVerifiedInSession,
} from "@/lib/supabase/session"
import { writeAuditLog } from "@/lib/utils/audit"

async function getAdminUser(userId: string) {
  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from("users")
    .select("id, email, role, full_name")
    .eq("id", userId)
    .single()
  return data
}

// GET — generate QR code for setup or re-setup
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userData = await getAdminUser(user.id)
  if (
    !userData ||
    !["BRANCH_ADMIN", "MASTER_ADMIN"].includes(userData.role)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const adminClient = createAdminClient()
  const { data: mfaRecord } = await adminClient
    .from("admin_mfa")
    .select("is_configured, backup_codes_hashed")
    .eq("admin_id", user.id)
    .single()

  // If configured AND session is verified AND no backup codes used
  // this is an unauthorized re-setup attempt — block it
  const sessionVerified = await isMfaVerifiedInSession(user.id)
  const allBackupCodesUsed =
    mfaRecord?.is_configured &&
    Array.isArray(mfaRecord.backup_codes_hashed) &&
    (mfaRecord.backup_codes_hashed as string[]).every(
      (c) => c === "USED"
    )

  const isResetupAfterBackupCode =
    mfaRecord?.is_configured && sessionVerified

  const isFirstTimeSetup = !mfaRecord?.is_configured

  const isAllCodesExhausted = allBackupCodesUsed && !sessionVerified

  if (
    !isFirstTimeSetup &&
    !isResetupAfterBackupCode &&
    !isAllCodesExhausted
  ) {
    // MFA is configured, session not verified, codes not exhausted
    // This is a normal login flow — should go to mfa-verify, not setup
    return NextResponse.json(
      { error: "MFA already configured" },
      { status: 400 }
    )
  }

  // Generate fresh secret
  const secret = generateTotpSecret()
  const encryptedSecret = await encryptTotpSecret(secret)
  const qrCodeDataUrl = await generateQrCodeDataUrl(
    secret,
    userData.email
  )

  // Store in pending state — is_configured = false until verified
  await adminClient.from("admin_mfa").upsert(
    {
      admin_id: user.id,
      totp_secret_encrypted: encryptedSecret,
      backup_codes_hashed: [],
      is_configured: false,
      failed_attempts: 0,
      locked_until: null,
    },
    { onConflict: "admin_id" }
  )

  return NextResponse.json({ qrCodeDataUrl })
}

// POST — verify the code, complete setup
const confirmSchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userData = await getAdminUser(user.id)
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

  const result = confirmSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { code } = result.data
  const adminClient = createAdminClient()

  const { data: mfaRecord } = await adminClient
    .from("admin_mfa")
    .select("totp_secret_encrypted, is_configured")
    .eq("admin_id", user.id)
    .single()

  // Must be in pending state (is_configured = false) to complete setup
  if (!mfaRecord || mfaRecord.is_configured) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const isValid = await verifyTotpCode(
    code,
    mfaRecord.totp_secret_encrypted
  )

  if (!isValid) {
    return NextResponse.json(
      { error: "Invalid code. Please try again." },
      { status: 400 }
    )
  }

  // Code verified — generate fresh backup codes and complete setup
  const { plaintext: backupPlaintext, hashed: backupHashed } =
    generateBackupCodes()

  await adminClient
    .from("admin_mfa")
    .update({
      backup_codes_hashed: backupHashed,
      is_configured: true,
      configured_at: new Date().toISOString(),
      last_verified_at: new Date().toISOString(),
      failed_attempts: 0,
      locked_until: null,
    })
    .eq("admin_id", user.id)

  // Set MFA verified cookie — setup counts as verification
  await setMfaVerifiedCookie(user.id)

  await writeAuditLog({
    actorId: user.id,
    actorRole: userData.role,
    actionType: "MFA_SETUP_COMPLETED",
    targetTable: "admin_mfa",
    targetId: user.id,
  })

  return NextResponse.json({ backupCodes: backupPlaintext })
}