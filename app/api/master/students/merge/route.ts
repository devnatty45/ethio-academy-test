// app/api/master/students/merge/route.ts
// Purpose: Preview and execute student profile merges
// Who can call it: MASTER_ADMIN only with sensitive action verified

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSensitiveActionVerified } from "@/lib/utils/sensitive-action"
import { writeAuditLog } from "@/lib/utils/audit"

// GET — preview merge of two students
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
  const studentAId = searchParams.get("studentA")
  const studentBId = searchParams.get("studentB")

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  if (
    !studentAId ||
    !studentBId ||
    !uuidRegex.test(studentAId) ||
    !uuidRegex.test(studentBId)
  ) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  if (studentAId === studentBId) {
    return NextResponse.json(
      { error: "Cannot merge a student with themselves" },
      { status: 400 }
    )
  }

  // Fetch both students with their linked data
  const [studentARes, studentBRes] = await Promise.all([
    adminClient
      .from("students")
      .select(`
        id, stu_id, full_name, date_of_birth, gender, status,
        created_at
      `)
      .eq("id", studentAId)
      .single(),
    adminClient
      .from("students")
      .select(`
        id, stu_id, full_name, date_of_birth, gender, status,
        created_at
      `)
      .eq("id", studentBId)
      .single(),
  ])

  if (!studentARes.data || !studentBRes.data) {
    return NextResponse.json(
      { error: "One or both students not found" },
      { status: 404 }
    )
  }

  // Fetch enrollment counts for each
  const [enrollmentsA, enrollmentsB] = await Promise.all([
    adminClient
      .from("enrollments")
      .select("id, status, academic_year_id")
      .eq("student_id", studentAId),
    adminClient
      .from("enrollments")
      .select("id, status, academic_year_id")
      .eq("student_id", studentBId),
  ])

  // Fetch guardian link counts
  const [linksA, linksB] = await Promise.all([
    adminClient
      .from("guardian_student_links")
      .select("id, link_type, is_active")
      .eq("student_id", studentAId),
    adminClient
      .from("guardian_student_links")
      .select("id, link_type, is_active")
      .eq("student_id", studentBId),
  ])

  // Determine which STU ID is older (lower number = older)
  const stuNumA = parseInt(
    studentARes.data.stu_id.replace("STU", ""),
    10
  )
  const stuNumB = parseInt(
    studentBRes.data.stu_id.replace("STU", ""),
    10
  )
  const suggestedSurvivingId =
    stuNumA <= stuNumB ? studentAId : studentBId

  return NextResponse.json({
    studentA: {
      ...studentARes.data,
      enrollmentCount: enrollmentsA.data?.length ?? 0,
      enrollments: enrollmentsA.data ?? [],
      guardianLinkCount: linksA.data?.length ?? 0,
    },
    studentB: {
      ...studentBRes.data,
      enrollmentCount: enrollmentsB.data?.length ?? 0,
      enrollments: enrollmentsB.data ?? [],
      guardianLinkCount: linksB.data?.length ?? 0,
    },
    suggestedSurvivingId,
  })
}

// POST — execute the merge
const mergeSchema = z.object({
  survivingStudentId: z.string().uuid(),
  mergedStudentId: z.string().uuid(),
  reason: z.string().min(10).max(500),
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

  const parsed = mergeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { survivingStudentId, mergedStudentId, reason } = parsed.data

  if (survivingStudentId === mergedStudentId) {
    return NextResponse.json(
      { error: "Cannot merge a student with themselves" },
      { status: 400 }
    )
  }

  const adminClient = createAdminClient()

  // Fetch both students before merge for audit log
  const [surviving, merged] = await Promise.all([
    adminClient
      .from("students")
      .select("id, stu_id, full_name, status")
      .eq("id", survivingStudentId)
      .single(),
    adminClient
      .from("students")
      .select("id, stu_id, full_name, status")
      .eq("id", mergedStudentId)
      .single(),
  ])

  if (!surviving.data || !merged.data) {
    return NextResponse.json(
      { error: "One or both students not found" },
      { status: 404 }
    )
  }

  if (
    surviving.data.status !== "ACTIVE" ||
    merged.data.status !== "ACTIVE"
  ) {
    return NextResponse.json(
      { error: "Both students must be ACTIVE to merge" },
      { status: 409 }
    )
  }

  // Check for enrollment conflicts — both students cannot have
  // enrollments in the same academic year
  const { data: survivingEnrollments } = await adminClient
    .from("enrollments")
    .select("academic_year_id")
    .eq("student_id", survivingStudentId)

  const { data: mergedEnrollments } = await adminClient
    .from("enrollments")
    .select("id, academic_year_id")
    .eq("student_id", mergedStudentId)

  const survivingYearIds = new Set(
    survivingEnrollments?.map((e) => e.academic_year_id) ?? []
  )

  const conflictingEnrollments = mergedEnrollments?.filter((e) =>
    survivingYearIds.has(e.academic_year_id)
  )

  if (conflictingEnrollments && conflictingEnrollments.length > 0) {
    return NextResponse.json(
      {
        error: `Cannot merge — both students have enrollments in ${conflictingEnrollments.length} of the same academic year(s). Resolve enrollment conflicts first.`,
      },
      { status: 409 }
    )
  }

  // Execute merge atomically
  // 1. Move enrollments from merged → surviving
  if (mergedEnrollments && mergedEnrollments.length > 0) {
    await adminClient
      .from("enrollments")
      .update({ student_id: survivingStudentId })
      .eq("student_id", mergedStudentId)
  }

  // 2. Move enrollment documents
  await adminClient
    .from("enrollment_documents")
    .update({ student_id: survivingStudentId })
    .eq("student_id", mergedStudentId)

  // 3. Move guardian links — skip if same guardian already linked
  const { data: mergedLinks } = await adminClient
    .from("guardian_student_links")
    .select("guardian_id, link_type")
    .eq("student_id", mergedStudentId)

  for (const link of mergedLinks ?? []) {
    const { data: existingLink } = await adminClient
      .from("guardian_student_links")
      .select("id")
      .eq("guardian_id", link.guardian_id)
      .eq("student_id", survivingStudentId)
      .single()

    if (!existingLink) {
      await adminClient
        .from("guardian_student_links")
        .update({ student_id: survivingStudentId })
        .eq("guardian_id", link.guardian_id)
        .eq("student_id", mergedStudentId)
    } else {
      // Duplicate — deactivate the merged link
      await adminClient
        .from("guardian_student_links")
        .update({ is_active: false })
        .eq("guardian_id", link.guardian_id)
        .eq("student_id", mergedStudentId)
    }
  }

  // 4. Mark merged student as MERGED
  await adminClient
    .from("students")
    .update({
      status: "MERGED",
      merged_into_student_id: survivingStudentId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", mergedStudentId)

  await writeAuditLog({
    actorId: masterAdmin.id,
    actorRole: "MASTER_ADMIN",
    actionType: "STUDENT_MERGED",
    targetTable: "students",
    targetId: survivingStudentId,
    oldValue: {
      surviving: {
        stu_id: surviving.data.stu_id,
        full_name: surviving.data.full_name,
      },
      merged: {
        stu_id: merged.data.stu_id,
        full_name: merged.data.full_name,
      },
    },
    newValue: {
      surviving_stu_id: surviving.data.stu_id,
      merged_stu_id: merged.data.stu_id,
      reason,
    },
  })

  return NextResponse.json({ success: true })
}