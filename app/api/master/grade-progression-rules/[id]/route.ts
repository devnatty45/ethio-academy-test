// app/api/master/grade-progression-rules/[id]/route.ts
// Purpose: Toggle rule active status
// Who can call it: MASTER_ADMIN only

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSensitiveActionVerified } from "@/lib/utils/sensitive-action"
import { writeAuditLog } from "@/lib/utils/audit"

const paramsSchema = z.object({ id: z.string().uuid() })
const updateSchema = z.object({ isActive: z.boolean() })

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

  const ruleId = paramsResult.data.id

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { isActive } = parsed.data
  const adminClient = createAdminClient()

  const { data: rule } = await adminClient
    .from("grade_progression_rules")
    .select("id, is_active, from_grade_id, from_branch_id")
    .eq("id", ruleId)
    .single()

  if (!rule) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 })
  }

  const { error: updateError } = await adminClient
    .from("grade_progression_rules")
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ruleId)

  if (updateError) {
    return NextResponse.json(
      { error: "Could not update rule" },
      { status: 500 }
    )
  }

  await writeAuditLog({
    actorId: masterAdmin.id,
    actorRole: "MASTER_ADMIN",
    actionType: isActive
      ? "GRADE_PROGRESSION_RULE_ACTIVATED"
      : "GRADE_PROGRESSION_RULE_DEACTIVATED",
    targetTable: "grade_progression_rules",
    targetId: ruleId,
    oldValue: { is_active: rule.is_active },
    newValue: { is_active: isActive },
  })

  return NextResponse.json({ success: true })
}