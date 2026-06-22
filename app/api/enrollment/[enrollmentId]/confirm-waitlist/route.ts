// app/api/enrollment/[enrollmentId]/confirm-waitlist/route.ts
// Purpose: Guardian confirms a WAITLIST_NOTIFIED enrollment
// Moves capacity from waitlist_count to pending_seats, then moves
// the enrollment into the normal review pipeline (PENDING_REVIEW)
// Who can call it: guardian who owns this enrollment

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { writeAuditLog } from "@/lib/utils/audit"

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
      "id, status, guardian_id, waitlist_notify_deadline_at, academic_year_id, branch_id, grade_id, stream_id"
    )
    .eq("id", enrollmentId)
    .eq("guardian_id", user.id)
    .single()

  if (!enrollment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (enrollment.status !== "WAITLIST_NOTIFIED") {
    return NextResponse.json(
      {
        error: `Cannot confirm — enrollment is in ${enrollment.status} status, not WAITLIST_NOTIFIED`,
      },
      { status: 409 }
    )
  }

  // Check the 24-hour confirmation window has not expired
  if (
    enrollment.waitlist_notify_deadline_at &&
    new Date(enrollment.waitlist_notify_deadline_at) < new Date()
  ) {
    return NextResponse.json(
      {
        error:
          "The confirmation window has expired. This seat may have been offered to the next person on the waitlist.",
      },
      { status: 410 }
    )
  }

  // Move the freed seat from waitlist_count into pending_seats
  const { error: capacityError } = await adminClient.rpc(
    "confirm_waitlist_promotion",
    {
      p_academic_year_id: enrollment.academic_year_id,
      p_branch_id: enrollment.branch_id,
      p_grade_id: enrollment.grade_id,
      p_stream_id: enrollment.stream_id,
    }
  )

  if (capacityError) {
    return NextResponse.json(
      { error: "Could not confirm seat capacity" },
      { status: 500 }
    )
  }

  const { error: updateError } = await adminClient
    .from("enrollments")
    .update({
      status: "PENDING_REVIEW",
      waitlist_notify_deadline_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", enrollmentId)

  if (updateError) {
    // Roll back capacity change — reverse the move we just made
    await adminClient.rpc("rollback_waitlist_promotion", {
      p_academic_year_id: enrollment.academic_year_id,
      p_branch_id: enrollment.branch_id,
      p_grade_id: enrollment.grade_id,
      p_stream_id: enrollment.stream_id,
    })

    return NextResponse.json(
      { error: "Could not confirm waitlist offer" },
      { status: 500 }
    )
  }

  await adminClient.from("enrollment_transitions").insert({
    enrollment_id: enrollmentId,
    from_status: "WAITLIST_NOTIFIED",
    to_status: "PENDING_REVIEW",
    actor_id: user.id,
    actor_role: "GUARDIAN",
    reason: "Guardian confirmed waitlist offer",
  })

  await writeAuditLog({
    actorId: user.id,
    actorRole: "GUARDIAN",
    actionType: "WAITLIST_OFFER_CONFIRMED",
    targetTable: "enrollments",
    targetId: enrollmentId,
    oldValue: { status: "WAITLIST_NOTIFIED" },
    newValue: { status: "PENDING_REVIEW" },
  })

  return NextResponse.json({
    success: true,
    status: "PENDING_REVIEW",
    message:
      "Your seat has been confirmed and your application is now pending review. Please upload any remaining documents.",
  })
}