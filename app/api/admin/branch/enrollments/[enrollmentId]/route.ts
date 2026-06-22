// app/api/admin/branch/enrollments/[enrollmentId]/route.ts
// Purpose: Get full enrollment details for admin review
// Who can call it: BRANCH_ADMIN for their branch, MASTER_ADMIN for any

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isMfaVerifiedInSession } from "@/lib/supabase/session"

const paramsSchema = z.object({ enrollmentId: z.string().uuid() })

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enrollmentId: string }> }
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

  const resolvedParams = await params
  const paramsResult = paramsSchema.safeParse(resolvedParams)
  if (!paramsResult.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { enrollmentId } = paramsResult.data

  // Fetch enrollment with all related data
  const { data: enrollment } = await adminClient
    .from("enrollments")
    .select(`
      id,
      status,
      student_category,
      academic_result,
      submitted_at,
      branch_id,
      grade_id,
      stream_id,
      guardian_id,
      students!inner (
        id, stu_id, full_name, date_of_birth, gender, status
      ),
      branches!inner (id, name),
      grades!inner (id, name, level_order),
      streams (id, name),
      academic_years!inner (id, name, status)
    `)
    .eq("id", enrollmentId)
    .single()

  if (!enrollment) {
    return NextResponse.json(
      { error: "Enrollment not found" },
      { status: 404 }
    )
  }

  // Branch admin branch check
  if (userData.role === "BRANCH_ADMIN") {
    const { data: adminProfile } = await adminClient
      .from("admin_profiles")
      .select("assigned_branch_id")
      .eq("user_id", user.id)
      .single()

    if (adminProfile?.assigned_branch_id !== enrollment.branch_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  // Fetch guardian profile (no FAN/FIN)
  const { data: guardianProfile } = await adminClient
    .from("guardian_profiles")
    .select(
      "full_name, phone, residential_address, is_complete"
    )
    .eq("user_id", enrollment.guardian_id)
    .single()

  // Fetch documents with rejection reasons
  const { data: documents } = await adminClient
    .from("enrollment_documents")
    .select(`
      id,
      doc_type,
      cloudinary_public_id,
      verification_status,
      rejection_note,
      is_reused_from_enrollment_id,
      uploaded_at,
      predefined_rejection_reasons (id, reason_text)
    `)
    .eq("enrollment_id", enrollmentId)
    .order("uploaded_at", { ascending: true })

  // Fetch predefined rejection reasons for dropdowns
  const { data: rejectionReasons } = await adminClient
    .from("predefined_rejection_reasons")
    .select("id, doc_type, reason_text")
    .eq("is_active", true)
    .order("doc_type")
    .order("reason_text")

  // Fetch enrollment history for this student
  const student = Array.isArray(enrollment.students)
    ? enrollment.students[0]
    : enrollment.students

  const { data: enrollmentHistory } = student
    ? await adminClient
        .from("enrollments")
        .select(`
          id, status, academic_result, submitted_at,
          academic_years!inner (name),
          branches!inner (name),
          grades!inner (name)
        `)
        .eq("student_id", student.id)
        .neq("id", enrollmentId)
        .order("submitted_at", { ascending: false })
        .limit(5)
    : { data: [] }

  return NextResponse.json({
    enrollment: {
      ...enrollment,
      student,
      branch: Array.isArray(enrollment.branches)
        ? enrollment.branches[0]
        : enrollment.branches,
      grade: Array.isArray(enrollment.grades)
        ? enrollment.grades[0]
        : enrollment.grades,
      stream: Array.isArray(enrollment.streams)
        ? enrollment.streams[0]
        : enrollment.streams,
      academicYear: Array.isArray(enrollment.academic_years)
        ? enrollment.academic_years[0]
        : enrollment.academic_years,
    },
    guardianProfile,
    documents: (documents ?? []).map((doc) => ({
      ...doc,
      rejectionReason: Array.isArray(doc.predefined_rejection_reasons)
        ? doc.predefined_rejection_reasons[0]
        : doc.predefined_rejection_reasons,
    })),
    rejectionReasons: rejectionReasons ?? [],
    enrollmentHistory: (enrollmentHistory ?? []).map((h) => ({
      id: h.id,
      status: h.status,
      academicResult: h.academic_result,
      submittedAt: h.submitted_at,
      academicYearName: Array.isArray(h.academic_years)
        ? h.academic_years[0]?.name
        : (h.academic_years as { name: string } | null)?.name,
      branchName: Array.isArray(h.branches)
        ? h.branches[0]?.name
        : (h.branches as { name: string } | null)?.name,
      gradeName: Array.isArray(h.grades)
        ? h.grades[0]?.name
        : (h.grades as { name: string } | null)?.name,
    })),
  })
}