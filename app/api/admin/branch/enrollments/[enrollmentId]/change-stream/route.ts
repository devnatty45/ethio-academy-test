// app/api/admin/branch/enrollments/[enrollmentId]/change-stream/route.ts
// Purpose: Move an ENROLLED student between streams (Chereta Grade 11/12 only)
// Atomically: release seat in old stream, reserve seat in new stream
// Who can call it: BRANCH_ADMIN for Chereta only, MASTER_ADMIN for any

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isMfaVerifiedInSession } from "@/lib/supabase/session"
import { writeAuditLog } from "@/lib/utils/audit"

const paramsSchema = z.object({ enrollmentId: z.string().uuid() })

const changeStreamSchema = z.object({
  newStreamId: z.string().uuid(),
  reason: z.string().min(10).max(500),
})

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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const parsed = changeStreamSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { newStreamId, reason } = parsed.data

  const { data: enrollment } = await adminClient
    .from("enrollments")
    .select(
      "id, status, branch_id, grade_id, stream_id, academic_year_id, guardian_id"
    )
    .eq("id", enrollmentId)
    .single()

  if (!enrollment) {
    return NextResponse.json(
      { error: "Enrollment not found" },
      { status: 404 }
    )
  }

  // Verify this is a Chereta branch enrollment
  const { data: branch } = await adminClient
    .from("branches")
    .select("name")
    .eq("id", enrollment.branch_id)
    .single()

  if (!branch || branch.name !== "Chereta") {
    return NextResponse.json(
      { error: "Stream changes are only available at Chereta branch" },
      { status: 409 }
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

  if (enrollment.status !== "ENROLLED") {
    return NextResponse.json(
      {
        error: `Stream changes only allowed for ENROLLED students — current status: ${enrollment.status}`,
      },
      { status: 409 }
    )
  }

  if (!enrollment.stream_id) {
    return NextResponse.json(
      { error: "This enrollment has no current stream to change from" },
      { status: 409 }
    )
  }

  if (enrollment.stream_id === newStreamId) {
    return NextResponse.json(
      { error: "Student is already in this stream" },
      { status: 409 }
    )
  }

  // Verify the new stream is configured for this branch/grade/year
  const { data: newStreamConfig } = await adminClient
    .from("branch_grade_stream_configs")
    .select("id")
    .eq("academic_year_id", enrollment.academic_year_id)
    .eq("branch_id", enrollment.branch_id)
    .eq("grade_id", enrollment.grade_id)
    .eq("stream_id", newStreamId)
    .eq("is_active", true)
    .single()

  if (!newStreamConfig) {
    return NextResponse.json(
      { error: "Target stream is not available for this grade" },
      { status: 409 }
    )
  }

  // Attempt to reserve a seat in the new stream first
  const { data: reservationResult, error: reservationError } =
    await adminClient.rpc("attempt_seat_reservation", {
      p_academic_year_id: enrollment.academic_year_id,
      p_branch_id: enrollment.branch_id,
      p_grade_id: enrollment.grade_id,
      p_stream_id: newStreamId,
    })

  if (reservationError) {
    return NextResponse.json(
      { error: "Could not process stream change" },
      { status: 500 }
    )
  }

  if (reservationResult === "blocked") {
    return NextResponse.json(
      { error: "Target stream is full and waitlist is also closed" },
      { status: 409 }
    )
  }

  if (reservationResult === "waitlisted") {
    // Roll back — we don't want to waitlist an already-enrolled student
    await adminClient.rpc("release_pending_seat", {
      p_academic_year_id: enrollment.academic_year_id,
      p_branch_id: enrollment.branch_id,
      p_grade_id: enrollment.grade_id,
      p_stream_id: newStreamId,
    })
    return NextResponse.json(
      {
        error:
          "Target stream is full. The student would be waitlisted, which is not allowed for an already-enrolled student.",
      },
      { status: 409 }
    )
  }

  // We reserved a "pending" seat in the new stream via attempt_seat_reservation,
  // but this student is already ENROLLED, so we need it in enrolled_seats not
  // pending_seats. Move it there, then release the old stream's enrolled seat.
  const { error: moveError } = await adminClient.rpc(
    "complete_stream_change",
    {
      p_academic_year_id: enrollment.academic_year_id,
      p_branch_id: enrollment.branch_id,
      p_grade_id: enrollment.grade_id,
      p_old_stream_id: enrollment.stream_id,
      p_new_stream_id: newStreamId,
    }
  )

  if (moveError) {
    // Roll back the pending reservation in new stream
    await adminClient.rpc("release_pending_seat", {
      p_academic_year_id: enrollment.academic_year_id,
      p_branch_id: enrollment.branch_id,
      p_grade_id: enrollment.grade_id,
      p_stream_id: newStreamId,
    })
    return NextResponse.json(
      { error: "Could not complete stream change" },
      { status: 500 }
    )
  }

  // Update the enrollment record
  const { error: updateError } = await adminClient
    .from("enrollments")
    .update({
      stream_id: newStreamId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", enrollmentId)

  if (updateError) {
    return NextResponse.json(
      { error: "Could not update enrollment record" },
      { status: 500 }
    )
  }

  await adminClient.from("enrollment_transitions").insert({
    enrollment_id: enrollmentId,
    from_status: "ENROLLED",
    to_status: "ENROLLED",
    actor_id: user.id,
    actor_role: userData.role,
    reason: `Stream changed: ${reason}`,
    metadata: {
      old_stream_id: enrollment.stream_id,
      new_stream_id: newStreamId,
    },
  })

  await writeAuditLog({
    actorId: user.id,
    actorRole: userData.role,
    actionType: "STREAM_CHANGED",
    targetTable: "enrollments",
    targetId: enrollmentId,
    oldValue: { stream_id: enrollment.stream_id },
    newValue: { stream_id: newStreamId, reason },
  })

  return NextResponse.json({ success: true, newStreamId })
}