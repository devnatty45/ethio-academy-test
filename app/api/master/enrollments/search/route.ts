// app/api/master/enrollments/search/route.ts
// Purpose: Search enrollments by student name or STU ID for override tool
// Who can call it: MASTER_ADMIN only

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
  const query = searchParams.get("q")?.trim()
  const academicYearId = searchParams.get("academicYearId")

  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: "Search query must be at least 2 characters" },
      { status: 400 }
    )
  }

  // Search by STU ID (exact) or name (ilike)
  const { data: students } = await adminClient
    .from("students")
    .select("id, stu_id, full_name, date_of_birth")
    .or(`stu_id.ilike.%${query}%,full_name.ilike.%${query}%`)
    .limit(10)

  if (!students || students.length === 0) {
    return NextResponse.json({ enrollments: [] })
  }

  const studentIds = students.map((s) => s.id)

  let enrollmentsQuery = adminClient
    .from("enrollments")
    .select(`
      id, status, student_category, submitted_at, payment_deadline_at,
      students!inner (id, stu_id, full_name),
      branches!inner (name),
      grades!inner (name),
      academic_years!inner (id, name)
    `)
    .in("student_id", studentIds)
    .order("submitted_at", { ascending: false })
    .limit(20)

  if (academicYearId) {
    enrollmentsQuery = enrollmentsQuery.eq(
      "academic_year_id",
      academicYearId
    )
  }

  const { data: enrollments } = await enrollmentsQuery

  return NextResponse.json({
    enrollments: (enrollments ?? []).map((e) => {
      const student = Array.isArray(e.students)
        ? e.students[0]
        : e.students
      const branch = Array.isArray(e.branches)
        ? e.branches[0]
        : e.branches
      const grade = Array.isArray(e.grades) ? e.grades[0] : e.grades
      const academicYear = Array.isArray(e.academic_years)
        ? e.academic_years[0]
        : e.academic_years

      return {
        id: e.id,
        status: e.status,
        studentCategory: e.student_category,
        submittedAt: e.submitted_at,
        paymentDeadlineAt: e.payment_deadline_at,
        student,
        branchName: branch?.name,
        gradeName: grade?.name,
        academicYear,
      }
    }),
  })
}