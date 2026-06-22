// app/api/master/grades/[id]/route.ts
// Purpose: Toggle grade active status
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

const updateGradeSchema = z.object({
  isActive: z.boolean(),
})

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

  const gradeId = paramsResult.data.id

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const parsed = updateGradeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { isActive } = parsed.data
  const adminClient = createAdminClient()

  const { data: grade } = await adminClient
    .from("grades")
    .select("id, name, is_active")
    .eq("id", gradeId)
    .single()

  if (!grade) {
    return NextResponse.json({ error: "Grade not found" }, { status: 404 })
  }

  // Prevent deactivating a grade with active branch_grade_configs
  if (!isActive) {
    const { count } = await adminClient
      .from("branch_grade_configs")
      .select("id", { count: "exact", head: true })
      .eq("grade_id", gradeId)
      .eq("is_active", true)

    if (count && count > 0) {
      return NextResponse.json(
        {
          error: `Cannot deactivate "${grade.name}" — it is assigned to ${count} active branch configuration${count === 1 ? "" : "s"}. Remove it from branch configurations first.`,
        },
        { status: 409 }
      )
    }
  }

  const { error: updateError } = await adminClient
    .from("grades")
    .update({ is_active: isActive })
    .eq("id", gradeId)

  if (updateError) {
    return NextResponse.json(
      { error: "Could not update grade" },
      { status: 500 }
    )
  }

  await writeAuditLog({
    actorId: masterAdmin.id,
    actorRole: "MASTER_ADMIN",
    actionType: isActive ? "GRADE_ACTIVATED" : "GRADE_DEACTIVATED",
    targetTable: "grades",
    targetId: gradeId,
    oldValue: { is_active: grade.is_active },
    newValue: { is_active: isActive },
  })

  return NextResponse.json({ success: true })
}