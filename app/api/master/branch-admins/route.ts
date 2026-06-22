// app/api/master/branch-admins/route.ts
// Purpose: List all branch admins and create new ones
// Who can call it: MASTER_ADMIN only

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSensitiveActionVerified } from "@/lib/utils/sensitive-action"
import { writeAuditLog } from "@/lib/utils/audit"

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

  const { data: admins, error } = await adminClient
  .from("users")
  .select(`
    id,
    email,
    full_name,
    status,
    created_at,
    admin_profiles (
      id,
      full_name,
      is_active,
      assigned_branch_id,
      branches!admin_profiles_assigned_branch_id_fkey (id, name, code)
    ),
    admin_mfa (
      is_configured,
      last_verified_at,
      locked_until
    )
  `)
  .eq("role", "BRANCH_ADMIN")
  .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json(
      { error: "Could not fetch branch admins" },
      { status: 500 }
    )
  }

  // Fetch active branches for assignment dropdown
  const { data: branches } = await adminClient
    .from("branches")
    .select("id, name, code")
    .eq("is_active", true)
    .order("name")

  return NextResponse.json({
    admins: admins ?? [],
    branches: branches ?? [],
  })
}

// POST — promote an existing Google user to BRANCH_ADMIN
// The person must have already signed in with Google at least once
const createAdminSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  fullName: z.string().min(2).max(100).trim(),
  branchId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  const result = await requireSensitiveActionVerified()
  if (result instanceof NextResponse) return result
  const masterAdmin = result

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const parsed = createAdminSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { email, fullName, branchId } = parsed.data
  const adminClient = createAdminClient()

  // Verify branch exists and is active
  const { data: branch } = await adminClient
    .from("branches")
    .select("id, name, is_active")
    .eq("id", branchId)
    .single()

  if (!branch || !branch.is_active) {
    return NextResponse.json(
      { error: "Branch not found or inactive" },
      { status: 404 }
    )
  }

  // Find existing user by email
  const { data: existingUser } = await adminClient
    .from("users")
    .select("id, role, status")
    .eq("email", email)
    .single()

  if (!existingUser) {
    return NextResponse.json(
      {
        error:
          "No account found for this email. The person must sign in with Google at least once before being assigned as Branch Admin.",
      },
      { status: 404 }
    )
  }

  if (existingUser.role === "BRANCH_ADMIN") {
    return NextResponse.json(
      { error: "This account is already a Branch Admin" },
      { status: 409 }
    )
  }

  if (existingUser.role === "MASTER_ADMIN") {
    return NextResponse.json(
      { error: "Cannot change role of a Master Admin account" },
      { status: 409 }
    )
  }

  // Check this branch does not already have an active admin
  const { data: existingBranchAdmin } = await adminClient
    .from("admin_profiles")
    .select("id, user_id")
    .eq("assigned_branch_id", branchId)
    .eq("is_active", true)
    .single()

  if (existingBranchAdmin) {
    return NextResponse.json(
      {
        error: `${branch.name} already has an active Branch Admin. Deactivate them first before assigning a new one.`,
      },
      { status: 409 }
    )
  }

  // Update user role
  await adminClient
    .from("users")
    .update({
      role: "BRANCH_ADMIN",
      full_name: fullName,
      status: "ACTIVE",
      updated_at: new Date().toISOString(),
    })
    .eq("id", existingUser.id)

  // Create or update admin_profile
  await adminClient
    .from("admin_profiles")
    .upsert(
      {
        user_id: existingUser.id,
        full_name: fullName,
        assigned_branch_id: branchId,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )

  await writeAuditLog({
    actorId: masterAdmin.id,
    actorRole: "MASTER_ADMIN",
    actionType: "BRANCH_ADMIN_CREATED",
    targetTable: "users",
    targetId: existingUser.id,
    oldValue: { role: existingUser.role },
    newValue: {
      role: "BRANCH_ADMIN",
      full_name: fullName,
      branch_id: branchId,
      branch_name: branch.name,
    },
  })

  return NextResponse.json({ success: true })
}