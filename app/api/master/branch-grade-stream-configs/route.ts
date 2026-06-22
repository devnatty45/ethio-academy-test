// app/api/master/branch-grade-stream-configs/route.ts
// Purpose: Get and set branch-grade-stream configs for an academic year
// Who can call it: MASTER_ADMIN only
// Streams only valid for Chereta branch, Grades 11 and 12

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSensitiveActionVerified } from "@/lib/utils/sensitive-action"
import { writeAuditLog } from "@/lib/utils/audit"

const CHERETA_CODE = "CHERETA"
const STREAM_GRADE_NAMES = ["Grade 11", "Grade 12"]

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

  // Fetch Chereta branch
  const { data: chebranch } = await adminClient
    .from("branches")
    .select("id, name, code")
    .eq("code", CHERETA_CODE)
    .single()

  if (!chebranch) {
    return NextResponse.json(
      { error: "Chereta branch not found" },
      { status: 404 }
    )
  }

  // Fetch Grade 11 and Grade 12 only
  const { data: grades } = await adminClient
    .from("grades")
    .select("id, name, level_order")
    .in("name", STREAM_GRADE_NAMES)
    .eq("is_active", true)
    .order("level_order")

  // Fetch active streams
  const { data: streams } = await adminClient
    .from("streams")
    .select("id, name, is_active")
    .eq("is_active", true)
    .order("name")

  // Fetch existing configs for this year
  const { data: configs } = await adminClient
    .from("branch_grade_stream_configs")
    .select("id, branch_id, grade_id, stream_id, is_active")
    .eq("academic_year_id", academicYearId)
    .eq("branch_id", chebranch.id)

  return NextResponse.json({
    chebranch,
    grades: grades ?? [],
    streams: streams ?? [],
    configs: configs ?? [],
  })
}

// POST — upsert a single branch-grade-stream config
const upsertSchema = z.object({
  academicYearId: z.string().uuid(),
  gradeId: z.string().uuid(),
  streamId: z.string().uuid(),
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

  const parsed = upsertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { academicYearId, gradeId, streamId, isActive } = parsed.data
  const adminClient = createAdminClient()

  // Verify academic year exists and is not archived
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

  if (academicYear.status === "ARCHIVED") {
    return NextResponse.json(
      { error: "Cannot modify archived academic year configurations" },
      { status: 409 }
    )
  }

  // Enforce Chereta-only rule — fetch Chereta branch ID
  const { data: chebranch } = await adminClient
    .from("branches")
    .select("id")
    .eq("code", CHERETA_CODE)
    .single()

  if (!chebranch) {
    return NextResponse.json(
      { error: "Chereta branch not found" },
      { status: 404 }
    )
  }

  // Enforce Grade 11 / 12 only rule
  const { data: grade } = await adminClient
    .from("grades")
    .select("id, name")
    .eq("id", gradeId)
    .single()

  if (!grade || !STREAM_GRADE_NAMES.includes(grade.name)) {
    return NextResponse.json(
      { error: "Streams can only be configured for Grade 11 and Grade 12" },
      { status: 409 }
    )
  }

  // If deactivating — check for active enrollments in this stream
  if (!isActive) {
    const { count } = await adminClient
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("academic_year_id", academicYearId)
      .eq("branch_id", chebranch.id)
      .eq("grade_id", gradeId)
      .eq("stream_id", streamId)
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
          error: `Cannot disable this stream — it has ${count} active enrollment${count === 1 ? "" : "s"}.`,
        },
        { status: 409 }
      )
    }
  }

  const { error: upsertError } = await adminClient
    .from("branch_grade_stream_configs")
    .upsert(
      {
        branch_id: chebranch.id,
        grade_id: gradeId,
        stream_id: streamId,
        academic_year_id: academicYearId,
        is_active: isActive,
      },
      { onConflict: "branch_id,grade_id,stream_id,academic_year_id" }
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
      ? "BRANCH_GRADE_STREAM_CONFIG_ENABLED"
      : "BRANCH_GRADE_STREAM_CONFIG_DISABLED",
    targetTable: "branch_grade_stream_configs",
    newValue: {
      branch_id: chebranch.id,
      grade_id: gradeId,
      stream_id: streamId,
      academic_year_id: academicYearId,
      is_active: isActive,
    },
  })

  return NextResponse.json({ success: true })
}