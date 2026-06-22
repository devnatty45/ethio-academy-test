// app/api/enrollment/submit/route.ts
// Purpose: Submit an enrollment — atomic seat reservation
// Who can call it: authenticated GUARDIAN with complete profile
// This is the core enrollment creation endpoint

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isGuardianProfileComplete } from "@/lib/utils/guardian"
import {
  getOpenAcademicYear,
  detectStudentCategory,
  getMostRecentEnrollment,
} from "@/lib/utils/enrollment"
import { writeAuditLog } from "@/lib/utils/audit"
import { queueSms } from "@/lib/utils/sms"

const submitSchema = z.object({
  studentId: z.string().uuid(),
  branchId: z.string().uuid(),
  gradeId: z.string().uuid(),
  streamId: z.string().uuid().nullable(),
})

export async function POST(request: NextRequest) {
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

  const profileComplete = await isGuardianProfileComplete(user.id)
  if (!profileComplete) {
    return NextResponse.json(
      { error: "Complete your profile before enrolling" },
      { status: 403 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const result = submitSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { studentId, branchId, gradeId, streamId } = result.data

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

  // Check for existing active enrollment this year
  const { data: existingEnrollment } = await adminClient
    .from("enrollments")
    .select("id, status")
    .eq("student_id", studentId)
    .eq("academic_year_id", openYear.id)
    .not("status", "in", '("CANCELLED")')
    .single()

  if (existingEnrollment) {
    return NextResponse.json(
      {
        error: "Student already has an active enrollment for this year",
        enrollmentId: existingEnrollment.id,
      },
      { status: 409 }
    )
  }

  // Abuse prevention: check EXPIRED count for this student this year
  const { count: expiredCount } = await adminClient
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId)
    .eq("academic_year_id", openYear.id)
    .eq("status", "EXPIRED")

  if ((expiredCount ?? 0) >= 2) {
    // Flag in audit log — 3rd attempt blocked
    await writeAuditLog({
      actorId: user.id,
      actorRole: "GUARDIAN",
      actionType: "ENROLLMENT_BLOCKED_EXPIRED_LIMIT",
      targetTable: "enrollments",
      newValue: {
        student_id: studentId,
        academic_year_id: openYear.id,
        expired_count: expiredCount,
      },
    })

    return NextResponse.json(
      {
        error:
          "Please contact school administration to proceed with enrollment.",
      },
      { status: 409 }
    )
  }

  // Grade gate enforcement — server-side
  const mostRecent = await getMostRecentEnrollment(studentId)
  if (mostRecent?.academic_result === "FAILED") {
    if (gradeId !== mostRecent.grade_id) {
      return NextResponse.json(
        {
          error:
            "Based on academic results, this student may only enroll in their current grade.",
        },
        { status: 409 }
      )
    }
    if (branchId !== mostRecent.branch_id) {
      return NextResponse.json(
        {
          error:
            "Based on academic results, this student may only enroll at their current branch.",
        },
        { status: 409 }
      )
    }
  }

  // Verify branch, grade, stream combination is configured for this year
  const { data: config } = await adminClient
    .from("branch_grade_configs")
    .select("id")
    .eq("academic_year_id", openYear.id)
    .eq("branch_id", branchId)
    .eq("grade_id", gradeId)
    .eq("is_active", true)
    .single()

  if (!config) {
    return NextResponse.json(
      {
        error:
          "This grade is not available at this branch for the current year",
      },
      { status: 409 }
    )
  }

  // If stream provided — verify it is configured
  if (streamId) {
    const { data: streamConfig } = await adminClient
      .from("branch_grade_stream_configs")
      .select("id")
      .eq("academic_year_id", openYear.id)
      .eq("branch_id", branchId)
      .eq("grade_id", gradeId)
      .eq("stream_id", streamId)
      .eq("is_active", true)
      .single()

    if (!streamConfig) {
      return NextResponse.json(
        { error: "This stream is not available for the current year" },
        { status: 409 }
      )
    }
  }

  // Detect student category
  const category = await detectStudentCategory(studentId, openYear.id)

  // Attempt atomic seat reservation
  const { data: reservationResult, error: reservationError } =
    await adminClient.rpc("attempt_seat_reservation", {
      p_academic_year_id: openYear.id,
      p_branch_id: branchId,
      p_grade_id: gradeId,
      p_stream_id: streamId,
    })

  if (reservationError) {
    return NextResponse.json(
      { error: "Could not process enrollment" },
      { status: 500 }
    )
  }

  if (reservationResult === "blocked") {
    return NextResponse.json(
      {
        error:
          "This grade is full and the waitlist is also closed. No more applications can be accepted.",
        blocked: true,
      },
      { status: 409 }
    )
  }

  const enrollmentStatus =
    reservationResult === "waitlisted"
      ? "WAITLISTED"
      : "PENDING_REVIEW"

  // Create enrollment record
  const { data: newEnrollment, error: enrollmentError } =
    await adminClient
      .from("enrollments")
      .insert({
        student_id: studentId,
        guardian_id: user.id,
        academic_year_id: openYear.id,
        branch_id: branchId,
        grade_id: gradeId,
        stream_id: streamId,
        student_category: category,
        status: enrollmentStatus,
        expired_count: expiredCount ?? 0,
        waitlisted_at:
          enrollmentStatus === "WAITLISTED"
            ? new Date().toISOString()
            : null,
      })
      .select("id")
      .single()

  if (enrollmentError || !newEnrollment) {
    console.error("[Submit] Enrollment insert error:", enrollmentError)
    // Roll back seat reservation
    if (reservationResult === "reserved") {
      await adminClient.rpc("release_pending_seat", {
        p_academic_year_id: openYear.id,
        p_branch_id: branchId,
        p_grade_id: gradeId,
        p_stream_id: streamId,
      })
    }
    return NextResponse.json(
      { error: "Could not create enrollment" },
      { status: 500 }
    )
  }

  // Log enrollment transition
  await adminClient.from("enrollment_transitions").insert({
    enrollment_id: newEnrollment.id,
    from_status: null,
    to_status: enrollmentStatus,
    actor_id: user.id,
    actor_role: "GUARDIAN",
    reason: "Guardian submitted enrollment",
    metadata: {
      category,
      reservation_result: reservationResult,
    },
  })

  // Fetch guardian phone first
  const { data: guardianProfile } = await adminClient
    .from("guardian_profiles")
    .select("phone")
    .eq("user_id", user.id)
    .single()

  if (guardianProfile?.phone) {
    // Dynamically choose the explicit copy matching the developer's request
    const statusMessage =
      enrollmentStatus === "WAITLISTED"
        ? "Your enrollment application has been submitted and added to the waitlist. You will be notified when a seat becomes available."
        : "Your enrollment application has been submitted and is pending review. We will notify you of the outcome."

    try {
      await queueSms({
        recipientPhone: guardianProfile.phone,
        messageBody: statusMessage,
        triggerEvent: "ENROLLMENT_SUBMITTED",
        relatedId: newEnrollment.id,
      })
    } catch (smsErr) {
      console.error("[Submit] Failed to queue submission status SMS:", smsErr)
    }
  }

  await writeAuditLog({
    actorId: user.id,
    actorRole: "GUARDIAN",
    actionType: "ENROLLMENT_SUBMITTED",
    targetTable: "enrollments",
    targetId: newEnrollment.id,
    newValue: {
      student_id: studentId,
      academic_year_id: openYear.id,
      branch_id: branchId,
      grade_id: gradeId,
      stream_id: streamId,
      status: enrollmentStatus,
      category,
    },
  })

  return NextResponse.json({
    success: true,
    enrollmentId: newEnrollment.id,
    status: enrollmentStatus,
    message:
      enrollmentStatus === "WAITLISTED"
        ? "Your application has been added to the waitlist."
        : "Your application has been submitted. Please upload the required documents.",
  })
}