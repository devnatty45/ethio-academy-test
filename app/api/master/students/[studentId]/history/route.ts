// app/api/master/students/[studentId]/history/route.ts
// Purpose: Full enrollment history for a student across all years
//          and branches — documents, transitions, academic results
// Who can call it: MASTER_ADMIN only

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isMfaVerifiedInSession } from "@/lib/supabase/session"

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

  const resolvedParams = await params
  const paramsResult = paramsSchema.safeParse(resolvedParams)
  if (!paramsResult.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { studentId } = paramsResult.data

  // Fetch student profile
  const { data: student } = await adminClient
    .from("students")
    .select("id, stu_id, full_name, date_of_birth, gender, status")
    .eq("id", studentId)
    .single()

  if (!student) {
    return NextResponse.json(
      { error: "Student not found" },
      { status: 404 }
    )
  }

  // Fetch all enrollments with related data
  const { data: enrollments } = await adminClient
    .from("enrollments")
    .select(`
      id, status, student_category, academic_result,
      submitted_at, payment_deadline_at, expired_count,
      branches!inner (name),
      grades!inner (name, level_order),
      streams (name),
      academic_years!inner (name, start_year),
      fee_structures (total_amount)
    `)
    .eq("student_id", studentId)
    .order("submitted_at", { ascending: false })

  // For each enrollment fetch documents and transitions
  const enrichedEnrollments = await Promise.all(
    (enrollments ?? []).map(async (e) => {
      const [docsResult, transitionsResult] = await Promise.all([
        adminClient
          .from("enrollment_documents")
          .select(
            "id, doc_type, verification_status, uploaded_at, rejection_note"
          )
          .eq("enrollment_id", e.id)
          .order("uploaded_at", { ascending: true }),
        adminClient
          .from("enrollment_transitions")
          .select(
            "id, from_status, to_status, actor_role, reason, created_at"
          )
          .eq("enrollment_id", e.id)
          .order("created_at", { ascending: true }),
      ])

      const branch = Array.isArray(e.branches)
        ? e.branches[0]
        : e.branches
      const grade = Array.isArray(e.grades) ? e.grades[0] : e.grades
      const stream = Array.isArray(e.streams)
        ? e.streams[0]
        : e.streams
      const academicYear = Array.isArray(e.academic_years)
        ? e.academic_years[0]
        : e.academic_years
      const feeStructure = Array.isArray(e.fee_structures)
        ? e.fee_structures[0]
        : e.fee_structures

      return {
        id: e.id,
        status: e.status,
        studentCategory: e.student_category,
        academicResult: e.academic_result,
        submittedAt: e.submitted_at,
        paymentDeadlineAt: e.payment_deadline_at,
        expiredCount: e.expired_count,
        branchName: branch?.name,
        gradeName: grade?.name,
        gradeOrder: grade?.level_order,
        streamName: stream?.name ?? null,
        academicYearName: academicYear?.name,
        academicYearStart: academicYear?.start_year,
        totalAmount: feeStructure?.total_amount ?? null,
        documents: docsResult.data ?? [],
        transitions: transitionsResult.data ?? [],
      }
    })
  )

  return NextResponse.json({ student, enrollments: enrichedEnrollments })
}