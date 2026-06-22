// app/api/enrollment/[enrollmentId]/resubmit/route.ts
// Purpose: Resubmit a REJECTED enrollment after fixing documents
// Re-attempts seat reservation since the original seat was released on rejection
// Who can call it: guardian who owns this enrollment

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { writeAuditLog } from "@/lib/utils/audit"
import { hasRejectedDocuments } from "@/lib/utils/enrollment-review"
import { queueSms } from "@/lib/utils/sms"

const paramsSchema = z.object({ enrollmentId: z.string().uuid() })

export async function POST(
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

  if (!userData || userData.role !== "GUARDIAN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const resolvedParams = await params
  const paramsResult = paramsSchema.safeParse(resolvedParams)
  if (!paramsResult.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { enrollmentId } = paramsResult.data

  const { data: enrollment } = await adminClient
    .from("enrollments")
    .select(
      "id, status, guardian_id, branch_id, grade_id, stream_id, academic_year_id"
    )
    .eq("id", enrollmentId)
    .eq("guardian_id", user.id)
    .single()

  if (!enrollment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (enrollment.status !== "REJECTED") {
    return NextResponse.json(
      {
        error: `Cannot resubmit — enrollment is in ${enrollment.status} status, not REJECTED`,
      },
      { status: 409 }
    )
  }

  const { data: academicYear } = await adminClient
    .from("academic_years")
    .select("status")
    .eq("id", enrollment.academic_year_id)
    .single()

  if (academicYear?.status !== "OPEN") {
    return NextResponse.json(
      {
        error:
          "Enrollment is no longer open for this academic year. Please contact the school.",
      },
      { status: 409 }
    )
  }

  const stillRejected = await hasRejectedDocuments(enrollmentId)
  if (stillRejected) {
    return NextResponse.json(
      {
        error:
          "Please replace all rejected documents before resubmitting",
      },
      { status: 409 }
    )
  }

  // The seat was released when this enrollment was rejected (Step 59).
  // Re-attempt reservation now — the grade may have filled up since.
  const { data: reservationResult, error: reservationError } =
    await adminClient.rpc("attempt_seat_reservation", {
      p_academic_year_id: enrollment.academic_year_id,
      p_branch_id: enrollment.branch_id,
      p_grade_id: enrollment.grade_id,
      p_stream_id: enrollment.stream_id,
    })

  if (reservationError) {
    return NextResponse.json(
      { error: "Could not process resubmission" },
      { status: 500 }
    )
  }

  if (reservationResult === "blocked") {
    return NextResponse.json(
      {
        error:
          "This grade has since filled up and the waitlist is also closed. Please contact the school.",
      },
      { status: 409 }
    )
  }

  const newStatus =
    reservationResult === "waitlisted" ? "WAITLISTED" : "PENDING_REVIEW"

  const { error: updateError } = await adminClient
    .from("enrollments")
    .update({
      status: newStatus,
      waitlisted_at:
        newStatus === "WAITLISTED" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", enrollmentId)

  if (updateError) {
    // Roll back the seat we just reserved
    if (reservationResult === "reserved") {
      await adminClient.rpc("release_pending_seat", {
        p_academic_year_id: enrollment.academic_year_id,
        p_branch_id: enrollment.branch_id,
        p_grade_id: enrollment.grade_id,
        p_stream_id: enrollment.stream_id,
      })
    }
    return NextResponse.json(
      { error: "Could not resubmit enrollment" },
      { status: 500 }
    )
  }

  await adminClient.from("enrollment_transitions").insert({
    enrollment_id: enrollmentId,
    from_status: "REJECTED",
    to_status: newStatus,
    actor_id: user.id,
    actor_role: "GUARDIAN",
    reason: "Guardian resubmitted after fixing rejected documents",
    metadata: { reservation_result: reservationResult },
  })

  await writeAuditLog({
    actorId: user.id,
    actorRole: "GUARDIAN",
    actionType: "ENROLLMENT_RESUBMITTED",
    targetTable: "enrollments",
    targetId: enrollmentId,
    oldValue: { status: "REJECTED" },
    newValue: { status: newStatus },
  })

  if (newStatus === "WAITLISTED") {
    const { data: guardianProfile } = await adminClient
      .from("guardian_profiles")
      .select("phone")
      .eq("user_id", user.id)
      .single()

    if (guardianProfile?.phone) {
      await queueSms({
        recipientPhone: guardianProfile.phone,
        messageBody:
          "Your resubmitted application has been added to the waitlist — the grade filled up while documents were being fixed.",
        triggerEvent: "ENROLLMENT_RESUBMITTED_WAITLISTED",
        relatedId: enrollmentId,
      })
    }
  }

  return NextResponse.json({
    success: true,
    status: newStatus,
    message:
      newStatus === "WAITLISTED"
        ? "The grade filled up — your resubmission has been added to the waitlist."
        : "Your application has been resubmitted and is pending review.",
  })
}