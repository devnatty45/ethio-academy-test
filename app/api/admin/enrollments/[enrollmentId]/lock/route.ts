// app/api/admin/enrollments/[enrollmentId]/lock/route.ts
// Purpose: Acquire or release a soft review lock on an enrollment
// Who can call it: BRANCH_ADMIN or MASTER_ADMIN with MFA

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isMfaVerifiedInSession } from "@/lib/supabase/session"

const paramsSchema = z.object({ enrollmentId: z.string().uuid() })

// GET — check current lock status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enrollmentId: string }> }
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

  const resolvedParams = await params
  const paramsResult = paramsSchema.safeParse(resolvedParams)
  if (!paramsResult.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { enrollmentId } = paramsResult.data

  // Delete expired locks first
  await adminClient
    .from("enrollment_review_locks")
    .delete()
    .eq("enrollment_id", enrollmentId)
    .lt("expires_at", new Date().toISOString())

  // Check for active lock
  const { data: lock } = await adminClient
    .from("enrollment_review_locks")
    .select(`
      id,
      locked_by_admin_id,
      locked_at,
      expires_at,
      users!locked_by_admin_id (full_name, email)
    `)
    .eq("enrollment_id", enrollmentId)
    .single()

  if (!lock) {
    return NextResponse.json({ locked: false })
  }

  const lockedByUser = Array.isArray(lock.users)
    ? lock.users[0]
    : lock.users

  const isOwnLock = lock.locked_by_admin_id === user.id

  return NextResponse.json({
    locked: true,
    isOwnLock,
    lockedBy: isOwnLock
      ? null
      : lockedByUser?.full_name ??
        lockedByUser?.email ??
        "Another admin",
    lockedAt: lock.locked_at,
    expiresAt: lock.expires_at,
  })
}

// POST — acquire or renew lock
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ enrollmentId: string }> }
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

  const { enrollmentId } = paramsResult.data

  const now = new Date()
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000) // 15 minutes

  // Delete expired locks
  await adminClient
    .from("enrollment_review_locks")
    .delete()
    .eq("enrollment_id", enrollmentId)
    .lt("expires_at", now.toISOString())

  // Check if another admin holds a valid lock
  const { data: existingLock } = await adminClient
    .from("enrollment_review_locks")
    .select("id, locked_by_admin_id, expires_at")
    .eq("enrollment_id", enrollmentId)
    .single()

  if (existingLock && existingLock.locked_by_admin_id !== user.id) {
    // Another admin holds the lock — allow but warn
    return NextResponse.json({
      acquired: false,
      warned: true,
      message:
        "Another admin is currently reviewing this application.",
    })
  }

  // Upsert own lock
  await adminClient
    .from("enrollment_review_locks")
    .upsert(
      {
        enrollment_id: enrollmentId,
        locked_by_admin_id: user.id,
        locked_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      },
      { onConflict: "enrollment_id" }
    )

  return NextResponse.json({
    acquired: true,
    warned: false,
    expiresAt: expiresAt.toISOString(),
  })
}

// DELETE — release lock
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ enrollmentId: string }> }
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

  const resolvedParams = await params
  const paramsResult = paramsSchema.safeParse(resolvedParams)
  if (!paramsResult.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { enrollmentId } = paramsResult.data

  // Only release own lock
  await adminClient
    .from("enrollment_review_locks")
    .delete()
    .eq("enrollment_id", enrollmentId)
    .eq("locked_by_admin_id", user.id)

  return NextResponse.json({ released: true })
}