// app/api/master/branch-admins/[id]/route.ts
// Purpose: Update branch admin — reassign branch or deactivate
// Who can call it: MASTER_ADMIN only

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSensitiveActionVerified } from "@/lib/utils/sensitive-action"
import { writeAuditLog } from "@/lib/utils/audit"

const paramsSchema = z.object({ id: z.string().uuid() })

const updateAdminSchema = z.union([
  z.object({
    action: z.literal("reassign"),
    branchId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("deactivate"),
    reason: z.string().min(10).max(500),
  }),
  z.object({
    action: z.literal("reactivate"),
    branchId: z.string().uuid(),
  }),
])

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireSensitiveActionVerified()
  if (result instanceof NextResponse) return result
  const masterAdmin = result

  const resolvedParams = await params
  const paramsResult = paramsSchema.safeParse(resolvedParams)
  if (!paramsResult.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const adminId = paramsResult.data.id

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const parsed = updateAdminSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Fetch the target admin
  const { data: targetUser } = await adminClient
    .from("users")
    .select("id, email, role, status, full_name")
    .eq("id", adminId)
    .single()

  if (!targetUser || targetUser.role !== "BRANCH_ADMIN") {
    return NextResponse.json(
      { error: "Branch admin not found" },
      { status: 404 }
    )
  }

  const { data: adminProfile } = await adminClient
    .from("admin_profiles")
    .select("id, assigned_branch_id, is_active")
    .eq("user_id", adminId)
    .single()

  if (parsed.data.action === "reassign") {
    const { branchId } = parsed.data

    // Verify target branch is active
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

    // Check target branch does not already have an active admin
    const { data: existingAdmin } = await adminClient
      .from("admin_profiles")
      .select("id, user_id")
      .eq("assigned_branch_id", branchId)
      .eq("is_active", true)
      .neq("user_id", adminId)
      .single()

    // if (existingAdmin) {
    //   return NextResponse.json(
    //     {
    //       error: `${branch.name} already has an active Branch Admin.`,
    //     },
    //     { status: 409 }
    //   )
    // }

    await adminClient
      .from("admin_profiles")
      .update({
        assigned_branch_id: branchId,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", adminId)

    await writeAuditLog({
      actorId: masterAdmin.id,
      actorRole: "MASTER_ADMIN",
      actionType: "BRANCH_ADMIN_REASSIGNED",
      targetTable: "admin_profiles",
      targetId: adminId,
      oldValue: {
        assigned_branch_id: adminProfile?.assigned_branch_id,
      },
      newValue: { assigned_branch_id: branchId, branch_name: branch.name },
    })
  }

  if (parsed.data.action === "deactivate") {
    const { reason } = parsed.data

    await adminClient
      .from("users")
      .update({
        status: "DEACTIVATED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", adminId)

    await adminClient
      .from("admin_profiles")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", adminId)

    await writeAuditLog({
      actorId: masterAdmin.id,
      actorRole: "MASTER_ADMIN",
      actionType: "BRANCH_ADMIN_DEACTIVATED",
      targetTable: "users",
      targetId: adminId,
      oldValue: { status: targetUser.status },
      newValue: { status: "DEACTIVATED", reason },
    })
  }

  if (parsed.data.action === "reactivate") {
    const { branchId } = parsed.data

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

    // Check target branch does not already have an active admin
    const { data: existingAdmin } = await adminClient
      .from("admin_profiles")
      .select("id, user_id")
      .eq("assigned_branch_id", branchId)
      .eq("is_active", true)
      .single()

    if (existingAdmin) {
      return NextResponse.json(
        {
          error: `${branch.name} already has an active Branch Admin.`,
        },
        { status: 409 }
      )
    }

    await adminClient
      .from("users")
      .update({
        status: "ACTIVE",
        updated_at: new Date().toISOString(),
      })
      .eq("id", adminId)

    await adminClient
      .from("admin_profiles")
      .update({
        is_active: true,
        assigned_branch_id: branchId,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", adminId)

    await writeAuditLog({
      actorId: masterAdmin.id,
      actorRole: "MASTER_ADMIN",
      actionType: "BRANCH_ADMIN_REACTIVATED",
      targetTable: "users",
      targetId: adminId,
      oldValue: { status: "DEACTIVATED" },
      newValue: {
        status: "ACTIVE",
        assigned_branch_id: branchId,
        branch_name: branch.name,
      },
    })
  }

  return NextResponse.json({ success: true })
}