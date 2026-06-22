// app/api/master/grades/route.ts
// Purpose: List all grades and add new ones
// Who can call it: MASTER_ADMIN only

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSensitiveActionVerified } from "@/lib/utils/sensitive-action"
import { writeAuditLog } from "@/lib/utils/audit"

// GET — list all grades ordered by level_order
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

  const { data: grades, error } = await adminClient
    .from("grades")
    .select("id, name, level_order, is_active, created_at")
    .order("level_order", { ascending: true })

  if (error) {
    return NextResponse.json(
      { error: "Could not fetch grades" },
      { status: 500 }
    )
  }

  return NextResponse.json({ grades: grades ?? [] })
}

// POST — add a new grade
const addGradeSchema = z.object({
  name: z.string().min(1).max(50).trim(),
  levelOrder: z.number().int().min(1).max(100),
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

  const parsed = addGradeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { name, levelOrder } = parsed.data
  const adminClient = createAdminClient()

  // Check for duplicate name or level_order
  const { data: existing } = await adminClient
    .from("grades")
    .select("id, name, level_order")
    .or(`name.eq.${name},level_order.eq.${levelOrder}`)

  if (existing && existing.length > 0) {
    const duplicate = existing[0]
    if (duplicate) {
      if (duplicate.name === name) {
        return NextResponse.json(
          { error: `A grade named "${name}" already exists` },
          { status: 409 }
        )
      }
      return NextResponse.json(
        {
          error: `Level order ${levelOrder} is already used by "${duplicate.name}"`,
        },
        { status: 409 }
      )
    }
  }

  const { data: newGrade, error: insertError } = await adminClient
    .from("grades")
    .insert({
      name,
      level_order: levelOrder,
      is_active: true,
    })
    .select("id, name, level_order")
    .single()

  if (insertError || !newGrade) {
    return NextResponse.json(
      { error: "Could not add grade" },
      { status: 500 }
    )
  }

  await writeAuditLog({
    actorId: masterAdmin.id,
    actorRole: "MASTER_ADMIN",
    actionType: "GRADE_CREATED",
    targetTable: "grades",
    targetId: newGrade.id,
    newValue: { name, level_order: levelOrder },
  })

  return NextResponse.json({ grade: newGrade })
}