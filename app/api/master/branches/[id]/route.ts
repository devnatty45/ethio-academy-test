// app/api/master/branches/[id]/route.ts
// Purpose: Get, update a specific branch (activate/deactivate)
// Who can call it: MASTER_ADMIN only

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSensitiveActionVerified } from "@/lib/utils/sensitive-action"
import { writeAuditLog } from "@/lib/utils/audit"

const paramsSchema = z.object({
  id: z.string().uuid(),
})

const updateBranchSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().min(10).max(500),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Requires sensitive action re-verification
  const result = await requireSensitiveActionVerified()
  if (result instanceof NextResponse) return result
  const masterAdmin = result

  const resolvedParams = await params
  const paramsResult = paramsSchema.safeParse(resolvedParams)
  if (!paramsResult.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const branchId = paramsResult.data.id

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const parsed = updateBranchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { isActive, reason } = parsed.data
  const adminClient = createAdminClient()

  // Fetch current branch state
  const { data: branch } = await adminClient
    .from("branches")
    .select("id, name, is_active")
    .eq("id", branchId)
    .single()

  if (!branch) {
    return NextResponse.json({ error: "Branch not found" }, { status: 404 })
  }

  // If deactivating — check for active enrollments in current year
  if (!isActive) {
    const { data: activeYear } = await adminClient
      .from("academic_years")
      .select("id")
      .eq("status", "OPEN")
      .single()

    if (activeYear) {
      const { count } = await adminClient
        .from("enrollments")
        .select("id", { count: "exact", head: true })
        .eq("branch_id", branchId)
        .eq("academic_year_id", activeYear.id)
        .in("status", [
          "PENDING_REVIEW",
          "PAYMENT_PENDING",
          "ENROLLED",
          "WAITLISTED",
          "WAITLIST_NOTIFIED",
        ])

      if (count && count > 0) {
        return NextResponse.json(
          {
            error: `Cannot deactivate branch. It has ${count} active enrollment${count === 1 ? "" : "s"} in the current academic year.`,
          },
          { status: 409 }
        )
      }
    }
  }

  // Update branch
  const { error: updateError } = await adminClient
    .from("branches")
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", branchId)

  if (updateError) {
    return NextResponse.json(
      { error: "Could not update branch" },
      { status: 500 }
    )
  }

  await writeAuditLog({
    actorId: masterAdmin.id,
    actorRole: "MASTER_ADMIN",
    actionType: isActive ? "BRANCH_ACTIVATED" : "BRANCH_DEACTIVATED",
    targetTable: "branches",
    targetId: branchId,
    oldValue: { is_active: branch.is_active },
    newValue: { is_active: isActive, reason },
  })

  return NextResponse.json({ success: true })
}