// app/api/master/admins/[userId]/unlock/route.ts
// Purpose: Master Admin unlocks a locked Branch Admin account
// Who can call it: MASTER_ADMIN only

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isMfaVerifiedInSession } from "@/lib/supabase/session"
import { writeAuditLog } from "@/lib/utils/audit"

const paramsSchema = z.object({ userId: z.string().uuid() })

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
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

  const { userId } = paramsResult.data

  const { data: targetUser } = await adminClient
    .from("users")
    .select("id, role, email, is_locked")
    .eq("id", userId)
    .single()

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  if (!["BRANCH_ADMIN", "MASTER_ADMIN"].includes(targetUser.role)) {
    return NextResponse.json(
      { error: "Can only unlock admin accounts" },
      { status: 409 }
    )
  }

  await adminClient
    .from("users")
    .update({
      is_locked: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)

  await writeAuditLog({
    actorId: user.id,
    actorRole: "MASTER_ADMIN",
    actionType: "ADMIN_ACCOUNT_UNLOCKED",
    targetTable: "users",
    targetId: userId,
    oldValue: { is_locked: true },
    newValue: { is_locked: false },
  })

  return NextResponse.json({ success: true })
}