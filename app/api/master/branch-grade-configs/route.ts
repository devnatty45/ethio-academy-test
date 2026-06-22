// app/api/master/branch-grade-configs/route.ts
// Purpose: Get and set branch-grade configurations for an academic year
// Who can call it: MASTER_ADMIN only

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSensitiveActionVerified } from "@/lib/utils/sensitive-action"
import { writeAuditLog } from "@/lib/utils/audit"

// GET — fetch all branch-grade configs for a given academic year
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

  const { searchParams } = new URL(request.url)
  const academicYearId = searchParams.get("academicYearId")

  if (!academicYearId) {
    return NextResponse.json(
      { error: "academicYearId is required" },
      { status: 400 }
    )
  }

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(academicYearId)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  // Fetch all active branches and grades
  const [branchesRes, gradesRes, configsRes] = await Promise.all([
    adminClient
      .from("branches")
      .select("id, name, code")
      .eq("is_active", true)
      .order("name"),
    adminClient
      .from("grades")
      .select("id, name, level_order")
      .eq("is_active", true)
      .order("level_order"),
    adminClient
      .from("branch_grade_configs")
      .select("id, branch_id, grade_id, is_active")
      .eq("academic_year_id", academicYearId),
  ])

  return NextResponse.json({
    branches: branchesRes.data ?? [],
    grades: gradesRes.data ?? [],
    configs: configsRes.data ?? [],
  })
}

// POST — upsert a single branch-grade config cell
const upsertConfigSchema = z.object({
  academicYearId: z.string().uuid(),
  branchId: z.string().uuid(),
  gradeId: z.string().uuid(),
  isActive: z.boolean(),
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

  const parsed = upsertConfigSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { academicYearId, branchId, gradeId, isActive } = parsed.data
  const adminClient = createAdminClient()

  // Verify the academic year exists
  const { data: academicYear } = await adminClient
    .from("academic_years")
    .select("id, status")
    .eq("id", academicYearId)
    .single()

  if (!academicYear) {
    return NextResponse.json(
      { error: "Academic year not found" },
      { status: 404 }
    )
  }

  // Cannot modify configs for ARCHIVED years
  if (academicYear.status === "ARCHIVED") {
    return NextResponse.json(
      { error: "Cannot modify configurations for archived academic years" },
      { status: 409 }
    )
  }

  // If deactivating — check for active enrollments
  if (!isActive) {
    const { count } = await adminClient
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("academic_year_id", academicYearId)
      .eq("branch_id", branchId)
      .eq("grade_id", gradeId)
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
          error: `Cannot remove this grade — it has ${count} active enrollment${count === 1 ? "" : "s"}.`,
        },
        { status: 409 }
      )
    }
  }

  // Streams: if grade is 11 or 12 and branch is Chereta,
  // the branch_grade_stream_configs handle the detail
  // Here we just manage the top-level branch_grade_configs

  const { error: upsertError } = await adminClient
    .from("branch_grade_configs")
    .upsert(
      {
        branch_id: branchId,
        grade_id: gradeId,
        academic_year_id: academicYearId,
        is_active: isActive,
      },
      { onConflict: "branch_id,grade_id,academic_year_id" }
    )

  if (upsertError) {
    return NextResponse.json(
      { error: "Could not update configuration" },
      { status: 500 }
    )
  }

  await writeAuditLog({
    actorId: masterAdmin.id,
    actorRole: "MASTER_ADMIN",
    actionType: isActive
      ? "BRANCH_GRADE_CONFIG_ENABLED"
      : "BRANCH_GRADE_CONFIG_DISABLED",
    targetTable: "branch_grade_configs",
    newValue: { branch_id: branchId, grade_id: gradeId, academic_year_id: academicYearId, is_active: isActive },
  })

  return NextResponse.json({ success: true })
}