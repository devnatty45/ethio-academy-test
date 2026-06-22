// app/api/master/grade-progression-rules/route.ts
// Purpose: List all grade progression rules and create new ones
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

  // Fetch rules with joined grade and branch names
  const { data: rules, error } = await adminClient
    .from("grade_progression_rules")
    .select(`
      id,
      is_active,
      created_at,
      updated_at,
      from_grade:grades!from_grade_id (id, name, level_order),
      from_branch:branches!from_branch_id (id, name),
      to_grade:grades!to_grade_id (id, name, level_order),
      to_branch:branches!to_branch_id (id, name)
    `)
    .order("created_at", { ascending: true })

  if (error) {
    return NextResponse.json(
      { error: "Could not fetch rules" },
      { status: 500 }
    )
  }

  // Fetch branches and grades for the add form dropdowns
  const [branchesRes, gradesRes] = await Promise.all([
    adminClient
      .from("branches")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
    adminClient
      .from("grades")
      .select("id, name, level_order")
      .eq("is_active", true)
      .order("level_order"),
  ])

  return NextResponse.json({
    rules: rules ?? [],
    branches: branchesRes.data ?? [],
    grades: gradesRes.data ?? [],
  })
}

// POST — create a new rule
const createRuleSchema = z.object({
  fromGradeId: z.string().uuid(),
  fromBranchId: z.string().uuid(),
  toGradeId: z.string().uuid(),
  toBranchId: z.string().uuid(),
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

  const parsed = createRuleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { fromGradeId, fromBranchId, toGradeId, toBranchId } = parsed.data
  const adminClient = createAdminClient()

  // Cannot create a rule where from and to are identical
  if (fromGradeId === toGradeId && fromBranchId === toBranchId) {
    return NextResponse.json(
      { error: "A rule cannot point from and to the same grade and branch" },
      { status: 409 }
    )
  }

  // Check for duplicate: one from_grade_id + from_branch_id combination only
  const { data: existing } = await adminClient
    .from("grade_progression_rules")
    .select("id")
    .eq("from_grade_id", fromGradeId)
    .eq("from_branch_id", fromBranchId)
    .eq("is_active", true)
    .single()

  if (existing) {
    return NextResponse.json(
      {
        error:
          "An active rule already exists for this grade-branch combination. Deactivate it first before creating a new one.",
      },
      { status: 409 }
    )
  }

  const { data: newRule, error: insertError } = await adminClient
    .from("grade_progression_rules")
    .insert({
      from_grade_id: fromGradeId,
      from_branch_id: fromBranchId,
      to_grade_id: toGradeId,
      to_branch_id: toBranchId,
      is_active: true,
    })
    .select("id")
    .single()

  if (insertError || !newRule) {
    return NextResponse.json(
      { error: "Could not create rule" },
      { status: 500 }
    )
  }

  await writeAuditLog({
    actorId: masterAdmin.id,
    actorRole: "MASTER_ADMIN",
    actionType: "GRADE_PROGRESSION_RULE_CREATED",
    targetTable: "grade_progression_rules",
    targetId: newRule.id,
    newValue: { fromGradeId, fromBranchId, toGradeId, toBranchId },
  })

  return NextResponse.json({ success: true })
}