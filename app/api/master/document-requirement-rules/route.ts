// app/api/master/document-requirement-rules/route.ts
// Purpose: List and manage document requirement rules
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

  const { data: rules, error } = await adminClient
    .from("document_requirement_rules")
    .select(`
      id,
      doc_type,
      student_category,
      is_required,
      is_reusable,
      requires_fresh_upload,
      applies_to_grade_id,
      applies_when_entering_grade_id,
      description,
      is_active,
      created_at,
      updated_at,
      entering_grade:grades!applies_when_entering_grade_id (id, name)
    `)
    .order("doc_type")
    .order("student_category")

  if (error) {
    return NextResponse.json(
      { error: "Could not fetch rules" },
      { status: 500 }
    )
  }

  // Fetch grades for the add form
  const { data: grades } = await adminClient
    .from("grades")
    .select("id, name, level_order")
    .eq("is_active", true)
    .order("level_order")

  return NextResponse.json({
    rules: rules ?? [],
    grades: grades ?? [],
  })
}

// POST — add a new exam certificate rule
const addExamRuleSchema = z.object({
  docType: z.string().min(1).max(100).trim(),
  enteringGradeId: z.string().uuid(),
  description: z.string().min(5).max(500).trim(),
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

  const parsed = addExamRuleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { docType, enteringGradeId, description } = parsed.data
  const adminClient = createAdminClient()

  // Check for duplicate
  const { data: existing } = await adminClient
    .from("document_requirement_rules")
    .select("id")
    .eq("doc_type", docType)
    .eq("applies_when_entering_grade_id", enteringGradeId)
    .eq("is_active", true)
    .single()

  if (existing) {
    return NextResponse.json(
      {
        error:
          "An active rule for this exam certificate and grade already exists.",
      },
      { status: 409 }
    )
  }

  const { data: newRule, error: insertError } = await adminClient
    .from("document_requirement_rules")
    .insert({
      doc_type: docType,
      student_category: "ALL",
      is_required: true,
      is_reusable: false,
      requires_fresh_upload: true,
      applies_when_entering_grade_id: enteringGradeId,
      description,
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
    actionType: "DOCUMENT_RULE_CREATED",
    targetTable: "document_requirement_rules",
    targetId: newRule.id,
    newValue: { docType, enteringGradeId, description },
  })

  return NextResponse.json({ success: true })
}