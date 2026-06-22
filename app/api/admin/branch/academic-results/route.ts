// app/api/admin/branch/academic-results/route.ts
// Purpose: List ENROLLED students for the admin's branch needing
//          academic results entered, grouped by grade
// Who can call it: BRANCH_ADMIN, MASTER_ADMIN

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

  if (
    !userData ||
    !["BRANCH_ADMIN", "MASTER_ADMIN"].includes(userData.role)
  ) {
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
  let branchId = searchParams.get("branchId")

  if (userData.role === "BRANCH_ADMIN") {
    const { data: adminProfile } = await adminClient
      .from("admin_profiles")
      .select("assigned_branch_id")
      .eq("user_id", user.id)
      .single()
    branchId = adminProfile?.assigned_branch_id ?? null
  }

  if (!branchId) {
    return NextResponse.json(
      { error: "No branch specified" },
      { status: 400 }
    )
  }

  const academicYearId = searchParams.get("academicYearId")
  if (!academicYearId) {
    return NextResponse.json(
      { error: "academicYearId is required" },
      { status: 400 }
    )
  }

  const { data: enrollments, error } = await adminClient
    .from("enrollments")
    .select(`
      id, academic_result, student_category,
      students!inner (id, stu_id, full_name),
      grades!inner (id, name, level_order),
      streams (id, name)
    `)
    .eq("branch_id", branchId)
    .eq("academic_year_id", academicYearId)
    .eq("status", "ENROLLED")
    .order("grades(level_order)")

  if (error) {
    return NextResponse.json(
      { error: "Could not fetch enrollments" },
      { status: 500 }
    )
  }

  return NextResponse.json({
    enrollments: (enrollments ?? []).map((e) => {
      const student = Array.isArray(e.students)
        ? e.students[0]
        : e.students
      const grade = Array.isArray(e.grades) ? e.grades[0] : e.grades
      const stream = Array.isArray(e.streams) ? e.streams[0] : e.streams
      return {
        id: e.id,
        academicResult: e.academic_result,
        studentCategory: e.student_category,
        student,
        grade,
        stream: stream ?? null,
      }
    }),
  })
}