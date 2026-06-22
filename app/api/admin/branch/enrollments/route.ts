// app/api/admin/branch/enrollments/route.ts
// Purpose: Get PENDING_REVIEW enrollments for the branch admin's branch
// Who can call it: BRANCH_ADMIN with MFA verified

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { isMfaVerifiedInSession } from "@/lib/supabase/session"

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

  if (!userData || userData.role !== "BRANCH_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const mfaVerified = await isMfaVerifiedInSession(user.id)
  if (!mfaVerified) {
    return NextResponse.json(
      { error: "MFA verification required" },
      { status: 403 }
    )
  }

  // Get admin's branch
  const { data: adminProfile } = await adminClient
    .from("admin_profiles")
    .select("assigned_branch_id")
    .eq("user_id", user.id)
    .single()

  if (!adminProfile?.assigned_branch_id) {
    return NextResponse.json(
      { error: "No branch assigned to this admin" },
      { status: 403 }
    )
  }

  const branchId = adminProfile.assigned_branch_id

  const { searchParams } = new URL(request.url)
  const filterGradeId = searchParams.get("gradeId")
  const filterCategory = searchParams.get("category")
  const filterAcademicYearId = searchParams.get("academicYearId")

  // Get current open year if not specified
  let academicYearId = filterAcademicYearId
  if (!academicYearId) {
    const { data: openYear } = await adminClient
      .from("academic_years")
      .select("id")
      .eq("status", "OPEN")
      .single()
    academicYearId = openYear?.id ?? null
  }

  if (!academicYearId) {
    return NextResponse.json({
      enrollments: [],
      branchId,
      academicYearId: null,
    })
  }

  // Build query
  let query = adminClient
    .from("enrollments")
    .select(`
      id,
      status,
      student_category,
      academic_result,
      submitted_at,
      student_id,
      grade_id,
      stream_id,
      students!inner (id, stu_id, full_name, date_of_birth, gender),
      grades!inner (id, name, level_order),
      streams (id, name),
      academic_years!inner (id, name)
    `)
    .eq("branch_id", branchId)
    .eq("academic_year_id", academicYearId)
    .eq("status", "PENDING_REVIEW")
    .order("submitted_at", { ascending: true })

  if (filterGradeId) {
    query = query.eq("grade_id", filterGradeId)
  }

  if (filterCategory) {
    query = query.eq(
      "student_category",
      filterCategory as "NEW" | "EXISTING" | "RETURNING"
    )
  }

  const { data: enrollments, error } = await query

  if (error) {
    return NextResponse.json(
      { error: "Could not fetch enrollments" },
      { status: 500 }
    )
  }

  // For each enrollment, get document summary
  const enrollmentIds = (enrollments ?? []).map((e) => e.id)

  const { data: allDocuments } = await adminClient
    .from("enrollment_documents")
    .select("enrollment_id, verification_status")
    .in("enrollment_id", enrollmentIds)

  // Build document summary per enrollment
  const docSummary: Record<
    string,
    { total: number; verified: number; rejected: number; pending: number }
  > = {}

  for (const doc of allDocuments ?? []) {
    if (!docSummary[doc.enrollment_id]) {
      docSummary[doc.enrollment_id] = {
        total: 0,
        verified: 0,
        rejected: 0,
        pending: 0,
      }
    }
    const summary = docSummary[doc.enrollment_id]!
    summary.total++
    if (doc.verification_status === "VERIFIED") summary.verified++
    else if (doc.verification_status === "REJECTED") summary.rejected++
    else summary.pending++
  }

  // Fetch available grades for filter dropdown
  const { data: branchGrades } = await adminClient
    .from("branch_grade_configs")
    .select(`grades!inner (id, name, level_order)`)
    .eq("branch_id", branchId)
    .eq("academic_year_id", academicYearId)
    .eq("is_active", true)
    .order("grades(level_order)")

  const grades = (branchGrades ?? [])
    .map((bg) => {
      const grade = Array.isArray(bg.grades) ? bg.grades[0] : bg.grades
      return grade
    })
    .filter(Boolean)
    .filter(
      (g, i, arr) => arr.findIndex((x) => x?.id === g?.id) === i
    )

  return NextResponse.json({
    enrollments: (enrollments ?? []).map((e) => {
      const student = Array.isArray(e.students)
        ? e.students[0]
        : e.students
      const grade = Array.isArray(e.grades) ? e.grades[0] : e.grades
      const stream = Array.isArray(e.streams) ? e.streams[0] : e.streams
      const academicYear = Array.isArray(e.academic_years)
        ? e.academic_years[0]
        : e.academic_years

      return {
        id: e.id,
        status: e.status,
        studentCategory: e.student_category,
        academicResult: e.academic_result,
        submittedAt: e.submitted_at,
        student,
        grade,
        stream: stream ?? null,
        academicYearName: academicYear?.name,
        documentSummary: docSummary[e.id] ?? {
          total: 0,
          verified: 0,
          rejected: 0,
          pending: 0,
        },
        flags: {
          hasAcademicResultPending: e.academic_result === "PENDING",
          hasRejectedDocs:
            (docSummary[e.id]?.rejected ?? 0) > 0,
        },
      }
    }),
    branchId,
    academicYearId,
    grades,
  })
}