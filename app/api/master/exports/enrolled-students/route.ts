// app/api/master/exports/enrolled-students/route.ts
// Purpose: Export all enrolled students by year and branch as CSV
// Who can call it: MASTER_ADMIN only

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { isMfaVerifiedInSession } from "@/lib/supabase/session"
import { writeAuditLog } from "@/lib/utils/audit"

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return ""
  const str =
    typeof value === "object"
      ? JSON.stringify(value)
      : String(value)
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

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

  const mfaVerified = await isMfaVerifiedInSession(user.id)
  if (!mfaVerified) {
    return NextResponse.json(
      { error: "MFA verification required" },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(request.url)
  const academicYearId = searchParams.get("academicYearId")
  const branchId = searchParams.get("branchId")

  if (!academicYearId) {
    return NextResponse.json(
      { error: "academicYearId is required" },
      { status: 400 }
    )
  }

  let query = adminClient
    .from("enrollments")
    .select(`
      id, student_category, academic_result, submitted_at,
      students!inner (stu_id, full_name, date_of_birth, gender),
      branches!inner (name),
      grades!inner (name, level_order),
      streams (name),
      academic_years!inner (name),
      fee_structures (total_amount)
    `)
    .eq("academic_year_id", academicYearId)
    .eq("status", "ENROLLED")

  if (branchId) query = query.eq("branch_id", branchId)

  const { data: enrollments, error } = await query

  if (error) {
    console.error("[ExportEnrolled] Query error:", error)
    return NextResponse.json(
      { error: "Could not fetch data" },
      { status: 500 }
    )
  }

  // Sort in JavaScript — branch name ascending, then grade level ascending
  const sorted = (enrollments ?? []).slice().sort((a, b) => {
    const aBranch = (
      Array.isArray(a.branches) ? a.branches[0] : a.branches
    )?.name ?? ""
    const bBranch = (
      Array.isArray(b.branches) ? b.branches[0] : b.branches
    )?.name ?? ""
    if (aBranch !== bBranch) return aBranch.localeCompare(bBranch)

    const aLevel = (
      Array.isArray(a.grades) ? a.grades[0] : a.grades
    )?.level_order ?? 0
    const bLevel = (
      Array.isArray(b.grades) ? b.grades[0] : b.grades
    )?.level_order ?? 0
    return aLevel - bLevel
  })

  const headers = [
    "STU ID",
    "Full Name",
    "Date of Birth",
    "Gender",
    "Branch",
    "Grade",
    "Stream",
    "Category",
    "Academic Result",
    "Fee (ETB)",
    "Submitted At",
    "Academic Year",
  ]

  const rows = sorted.map((e) => {
    const student = Array.isArray(e.students)
      ? e.students[0]
      : e.students
    const branch = Array.isArray(e.branches)
      ? e.branches[0]
      : e.branches
    const grade = Array.isArray(e.grades) ? e.grades[0] : e.grades
    const stream = Array.isArray(e.streams) ? e.streams[0] : e.streams
    const year = Array.isArray(e.academic_years)
      ? e.academic_years[0]
      : e.academic_years
    const fee = Array.isArray(e.fee_structures)
      ? e.fee_structures[0]
      : e.fee_structures

    return [
      student?.stu_id,
      student?.full_name,
      student?.date_of_birth,
      student?.gender,
      branch?.name,
      grade?.name,
      stream?.name ?? "",
      e.student_category,
      e.academic_result,
      fee?.total_amount ?? "",
      e.submitted_at,
      year?.name,
    ].map(escapeCSV)
  })

  const csv = [
    headers.join(","),
    ...rows.map((r) => r.join(",")),
  ].join("\n")

  await writeAuditLog({
    actorId: user.id,
    actorRole: "MASTER_ADMIN",
    actionType: "EXPORT_ENROLLED_STUDENTS",
    targetTable: "enrollments",
    targetId: undefined,
    newValue: {
      academicYearId,
      branchId: branchId ?? "all",
      rowCount: rows.length,
    },
  })

  const filename = `enrolled-students-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}