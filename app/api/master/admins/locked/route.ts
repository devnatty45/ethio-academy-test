// app/api/master/admins/locked/route.ts
// Purpose: Get all locked admin accounts and manually unlock them
// Who can call it: MASTER_ADMIN only with MFA verified in session

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSensitiveActionVerified } from "@/lib/utils/sensitive-action"
import { writeAuditLog } from "@/lib/utils/audit"

// GET — fetch all currently locked admin accounts
export async function GET(request: NextRequest) {
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

  // Fetch all admins with active lockouts
  const { data: lockedAdmins, error } = await adminClient
    .from("admin_mfa")
    .select(
      `
      admin_id,
      failed_attempts,
      locked_until,
      last_verified_at,
      users!inner (
        id,
        email,
        full_name,
        role
      )
    `
    )
    .not("locked_until", "is", null)
    .gt("locked_until", new Date().toISOString())
    .order("locked_until", { ascending: true })

  if (error) {
    return NextResponse.json(
      { error: "Could not fetch locked accounts" },
      { status: 500 }
    )
  }

  return NextResponse.json({ lockedAdmins: lockedAdmins ?? [] })
}

// POST — manually unlock an admin account
const unlockSchema = z.object({
  adminId: z.string().uuid(),
  reason: z.string().min(10).max(500),
})

export async function POST(request: NextRequest) {
  // Requires sensitive action re-verification
  const result = await requireSensitiveActionVerified()
  if (result instanceof NextResponse) return result
  const masterAdmin = result

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const parsed = unlockSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { adminId, reason } = parsed.data

  const adminClient = createAdminClient()

  // Verify the target is actually locked
  const { data: mfaRecord } = await adminClient
    .from("admin_mfa")
    .select("locked_until, failed_attempts, admin_id")
    .eq("admin_id", adminId)
    .single()

  if (!mfaRecord) {
    return NextResponse.json(
      { error: "Admin account not found" },
      { status: 404 }
    )
  }

  if (
    !mfaRecord.locked_until ||
    new Date(mfaRecord.locked_until) <= new Date()
  ) {
    return NextResponse.json(
      { error: "Account is not currently locked" },
      { status: 400 }
    )
  }

  // Unlock the account
  const { error: updateError } = await adminClient
    .from("admin_mfa")
    .update({
      locked_until: null,
      failed_attempts: 0,
    })
    .eq("admin_id", adminId)

  if (updateError) {
    return NextResponse.json(
      { error: "Could not unlock account" },
      { status: 500 }
    )
  }

  await writeAuditLog({
    actorId: masterAdmin.id,
    actorRole: "MASTER_ADMIN",
    actionType: "ADMIN_ACCOUNT_UNLOCKED",
    targetTable: "admin_mfa",
    targetId: adminId,
    oldValue: {
      locked_until: mfaRecord.locked_until,
      failed_attempts: mfaRecord.failed_attempts,
    },
    newValue: {
      locked_until: null,
      failed_attempts: 0,
      unlock_reason: reason,
    },
  })

  return NextResponse.json({ success: true })
}