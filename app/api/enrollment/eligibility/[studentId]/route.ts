// app/api/enrollment/eligibility/[studentId]/route.ts
// Purpose: Get enrollment eligibility for a student in the current year
// Returns: academic result, allowed grades, student category
// Who can call it: guardian linked to this student

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  getOpenAcademicYear,
  getMostRecentEnrollment,
  detectStudentCategory,
} from "@/lib/utils/enrollment"

const paramsSchema = z.object({ studentId: z.string().uuid() })

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
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

  if (!userData || userData.role !== "GUARDIAN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const resolvedParams = await params
  const paramsResult = paramsSchema.safeParse(resolvedParams)
  if (!paramsResult.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { studentId } = paramsResult.data

  // Verify guardian is linked to this student
  const { data: link } = await adminClient
    .from("guardian_student_links")
    .select("id")
    .eq("guardian_id", user.id)
    .eq("student_id", studentId)
    .eq("is_active", true)
    .single()

  if (!link) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Verify enrollment is open
  const openYear = await getOpenAcademicYear()
  if (!openYear) {
    return NextResponse.json(
      { error: "Enrollment is not currently open" },
      { status: 409 }
    )
  }

  // Check if student already has an active enrollment this year
  const { data: existingEnrollment } = await adminClient
    .from("enrollments")
    .select("id, status")
    .eq("student_id", studentId)
    .eq("academic_year_id", openYear.id)
    .not("status", "in", '("CANCELLED")')
    .single()

  if (existingEnrollment) {
    return NextResponse.json({
      alreadyEnrolled: true,
      existingEnrollmentId: existingEnrollment.id,
      existingStatus: existingEnrollment.status,
    })
  }

  // Get most recent enrollment for grade gate + category detection
  const mostRecent = await getMostRecentEnrollment(studentId)
  const category = await detectStudentCategory(
    studentId,
    openYear.id
  )

  // Determine academic result gate
  let academicResult: "PENDING" | "PASSED" | "FAILED" = "PENDING"
  let lockedGradeId: string | null = null
  let lockedGradeName: string | null = null

  if (mostRecent) {
    academicResult = mostRecent.academic_result as
      | "PENDING"
      | "PASSED"
      | "FAILED"

    if (academicResult === "FAILED") {
      // Lock to same grade
      lockedGradeId = mostRecent.grade_id

      const { data: grade } = await adminClient
        .from("grades")
        .select("name")
        .eq("id", mostRecent.grade_id)
        .single()

      lockedGradeName = grade?.name ?? null
    }
  }

  // Fetch student details
  const { data: student } = await adminClient
    .from("students")
    .select("id, stu_id, full_name, date_of_birth, gender")
    .eq("id", studentId)
    .single()

  return NextResponse.json({
    alreadyEnrolled: false,
    student,
    openYear: {
      id: openYear.id,
      name: openYear.name,
    },
    category,
    academicResult,
    lockedGradeId,
    lockedGradeName,
    mostRecentEnrollment: mostRecent
      ? {
          gradeId: mostRecent.grade_id,
          branchId: mostRecent.branch_id,
          academicResult: mostRecent.academic_result,
        }
      : null,
  })
}