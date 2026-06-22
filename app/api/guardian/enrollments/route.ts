// app/api/guardian/enrollments/route.ts
// Purpose: Get all enrollments for the current guardian
//          with full status details for dashboard display
// Who can call it: authenticated GUARDIAN only

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"

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

  if (!userData || userData.role !== "GUARDIAN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Fetch all active student links
  const { data: links } = await adminClient
    .from("guardian_student_links")
    .select(`
      id,
      link_type,
      student_id,
      students!inner (
        id, stu_id, full_name, date_of_birth, gender
      )
    `)
    .eq("guardian_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })

  if (!links || links.length === 0) {
    return NextResponse.json({ students: [] })
  }

  const studentIds = links.map((l) => l.student_id)

  // Fetch all non-cancelled enrollments for these students
  const { data: enrollments } = await adminClient
    .from("enrollments")
    .select(`
      id,
      student_id,
      status,
      student_category,
      academic_result,
      payment_deadline_at,
      waitlisted_at,
      waitlist_notify_deadline_at,
      submitted_at,
      academic_years!inner (id, name, status),
      branches!inner (id, name),
      grades!inner (id, name),
      streams (id, name)
    `)
    .in("student_id", studentIds)
    .not("status", "in", '("CANCELLED")')
    .order("submitted_at", { ascending: false })

  // Fetch rejection details for REJECTED enrollments
  const rejectedIds = (enrollments ?? [])
    .filter((e) => e.status === "REJECTED")
    .map((e) => e.id)

  const { data: rejectedDocs } = rejectedIds.length > 0
    ? await adminClient
        .from("enrollment_documents")
        .select(`
          enrollment_id,
          doc_type,
          verification_status,
          rejection_note,
          predefined_rejection_reasons (reason_text)
        `)
        .in("enrollment_id", rejectedIds)
        .eq("verification_status", "REJECTED")
    : { data: [] }

  // Fetch waitlist positions
  const waitlistedIds = (enrollments ?? [])
    .filter((e) => e.status === "WAITLISTED")
    .map((e) => e.id)

  const waitlistPositions: Record<string, number> = {}
  for (const enrollmentId of waitlistedIds) {
    const enrollment = (enrollments ?? []).find(
      (e) => e.id === enrollmentId
    )
    if (!enrollment) continue

    const { count } = await adminClient
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("academic_year_id",
        Array.isArray(enrollment.academic_years)
          ? enrollment.academic_years[0]?.id
          : (enrollment.academic_years as { id: string } | null)?.id ?? ""
      )
      .eq("branch_id",
        Array.isArray(enrollment.branches)
          ? enrollment.branches[0]?.id
          : (enrollment.branches as { id: string } | null)?.id ?? ""
      )
      .eq("grade_id",
        Array.isArray(enrollment.grades)
          ? enrollment.grades[0]?.id
          : (enrollment.grades as { id: string } | null)?.id ?? ""
      )
      .eq("status", "WAITLISTED")
      .lte("waitlisted_at", enrollment.waitlisted_at ?? new Date().toISOString())

    waitlistPositions[enrollmentId] = count ?? 1
  }

  // Build response grouped by student
  const studentMap: Record<
    string,
    {
      student: {
        id: string
        stu_id: string
        full_name: string
        date_of_birth: string
        gender: string
      }
      linkType: string
      enrollments: unknown[]
    }
  > = {}

  for (const link of links) {
    const student = Array.isArray(link.students)
      ? link.students[0]
      : link.students

    if (!student) continue

    studentMap[link.student_id] = {
      student,
      linkType: link.link_type,
      enrollments: [],
    }
  }

  for (const enrollment of enrollments ?? []) {
    const entry = studentMap[enrollment.student_id]
    if (!entry) continue

    const academicYear = Array.isArray(enrollment.academic_years)
      ? enrollment.academic_years[0]
      : enrollment.academic_years
    const branch = Array.isArray(enrollment.branches)
      ? enrollment.branches[0]
      : enrollment.branches
    const grade = Array.isArray(enrollment.grades)
      ? enrollment.grades[0]
      : enrollment.grades
    const stream = Array.isArray(enrollment.streams)
      ? enrollment.streams[0]
      : enrollment.streams

    const rejections = (rejectedDocs ?? [])
      .filter((d) => d.enrollment_id === enrollment.id)
      .map((d) => ({
        docType: d.doc_type,
        reason: Array.isArray(d.predefined_rejection_reasons)
          ? d.predefined_rejection_reasons[0]?.reason_text
          : (d.predefined_rejection_reasons as { reason_text: string } | null)
              ?.reason_text,
        note: d.rejection_note,
      }))

    entry.enrollments.push({
      id: enrollment.id,
      status: enrollment.status,
      studentCategory: enrollment.student_category,
      academicResult: enrollment.academic_result,
      paymentDeadlineAt: enrollment.payment_deadline_at,
      waitlistedAt: enrollment.waitlisted_at,
      waitlistNotifyDeadlineAt: enrollment.waitlist_notify_deadline_at,
      submittedAt: enrollment.submitted_at,
      academicYearName: academicYear?.name,
      academicYearStatus: academicYear?.status,
      branchName: branch?.name,
      gradeName: grade?.name,
      streamName: stream?.name ?? null,
      rejectedDocuments: rejections,
      waitlistPosition: waitlistPositions[enrollment.id] ?? null,
    })
  }

  return NextResponse.json({
    students: Object.values(studentMap),
  })
}