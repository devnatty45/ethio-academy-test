// app/api/admin/branch/enrollments/[enrollmentId]/reject/route.ts
// Purpose: Reject an enrollment — release seat, check waitlist promotion
// Who can call it: BRANCH_ADMIN for their branch, MASTER_ADMIN for any

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isMfaVerifiedInSession } from "@/lib/supabase/session"
import { hasRejectedDocuments } from "@/lib/utils/enrollment-review"
import { writeAuditLog } from "@/lib/utils/audit"
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

  const { data: enrollment } = await adminClient
    .from("enrollments")
    .select(
      "id, status, branch_id, grade_id, stream_id, academic_year_id, guardian_id, student_id"
    )
    .eq("id", enrollmentId)
    .single()

  if (!enrollment) {
    return NextResponse.json(
      { error: "Enrollment not found" },
      { status: 404 }
    )
  }

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

  if (enrollment.status !== "PENDING_REVIEW") {
    return NextResponse.json(
      {
        error: `Cannot reject — enrollment is in ${enrollment.status} status`,
      },
      { status: 409 }
    )
  }

  // Server-side enforcement: at least one document must be REJECTED
  const hasRejection = await hasRejectedDocuments(enrollmentId)
  if (!hasRejection) {
    return NextResponse.json(
      {
        error:
          "At least one document must be REJECTED before rejecting this enrollment",
      },
      { status: 409 }
    )
  }

  // Release the pending seat back to the pool
  const { error: releaseError } = await adminClient.rpc(
    "release_pending_seat",
    {
      p_academic_year_id: enrollment.academic_year_id,
      p_branch_id: enrollment.branch_id,
      p_grade_id: enrollment.grade_id,
      p_stream_id: enrollment.stream_id,
    }
  )

  if (releaseError) {
    return NextResponse.json(
      { error: "Could not release seat" },
      { status: 500 }
    )
  }

  // Update enrollment status
  const { error: updateError } = await adminClient
    .from("enrollments")
    .update({
      status: "REJECTED",
      updated_at: new Date().toISOString(),
    })
    .eq("id", enrollmentId)

  if (updateError) {
    return NextResponse.json(
      { error: "Could not update enrollment" },
      { status: 500 }
    )
  }

  // Log transition
  await adminClient.from("enrollment_transitions").insert({
    enrollment_id: enrollmentId,
    from_status: "PENDING_REVIEW",
    to_status: "REJECTED",
    actor_id: user.id,
    actor_role: userData.role,
    reason: "One or more documents rejected by admin",
  })

  // Release the soft lock
  await adminClient
    .from("enrollment_review_locks")
    .delete()
    .eq("enrollment_id", enrollmentId)

  // Check waitlist promotion — a seat just freed up
  const { data: nextWaitlisted } = await adminClient
    .from("enrollments")
    .select("id, guardian_id")
    .eq("academic_year_id", enrollment.academic_year_id)
    .eq("branch_id", enrollment.branch_id)
    .eq("grade_id", enrollment.grade_id)
    .eq(
      "stream_id",
      enrollment.stream_id ?? "00000000-0000-0000-0000-000000000000"
    )
    .eq("status", "WAITLISTED")
    .order("waitlisted_at", { ascending: true })
    .limit(1)
    .single()

  // Fallback for null stream_id
  let promotionCandidate = nextWaitlisted
  if (!promotionCandidate && !enrollment.stream_id) {
    const { data: candidateNoStream } = await adminClient
      .from("enrollments")
      .select("id, guardian_id")
      .eq("academic_year_id", enrollment.academic_year_id)
      .eq("branch_id", enrollment.branch_id)
      .eq("grade_id", enrollment.grade_id)
      .is("stream_id", null)
      .eq("status", "WAITLISTED")
      .order("waitlisted_at", { ascending: true })
      .limit(1)
      .single()
    promotionCandidate = candidateNoStream
  }

  if (promotionCandidate) {
    const notifyDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    await adminClient
      .from("enrollments")
      .update({
        status: "WAITLIST_NOTIFIED",
        waitlist_notify_deadline_at: notifyDeadline.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", promotionCandidate.id)

    await adminClient.from("enrollment_transitions").insert({
      enrollment_id: promotionCandidate.id,
      from_status: "WAITLISTED",
      to_status: "WAITLIST_NOTIFIED",
      actor_id: user.id,
      actor_role: userData.role,
      reason: "Seat freed up — promoted from waitlist",
    })

    const { data: promotedGuardianProfile } = await adminClient
      .from("guardian_profiles")
      .select("phone")
      .eq("user_id", promotionCandidate.guardian_id)
      .single()

    if (promotedGuardianProfile?.phone) {
      await queueSms({
        recipientPhone: promotedGuardianProfile.phone,
        messageBody: `A seat has become available. You have 24 hours to confirm your enrollment. Please log in to confirm.`,
        triggerEvent: "WAITLIST_PROMOTED",
        relatedId: promotionCandidate.id,
      })
    }
  }

  // Fetch rejection details for the SMS to the rejected guardian
  const { data: rejectedDocs } = await adminClient
    .from("enrollment_documents")
    .select(`
      doc_type,
      rejection_note,
      predefined_rejection_reasons (reason_text)
    `)
    .eq("enrollment_id", enrollmentId)
    .eq("verification_status", "REJECTED")

  const rejectionSummary = (rejectedDocs ?? [])
    .map((d) => {
      const reason = Array.isArray(d.predefined_rejection_reasons)
        ? d.predefined_rejection_reasons[0]?.reason_text
        : (d.predefined_rejection_reasons as { reason_text: string } | null)
            ?.reason_text
      return `${d.doc_type}: ${reason ?? "see details in app"}`
    })
    .join("; ")

  const { data: guardianProfile } = await adminClient
    .from("guardian_profiles")
    .select("phone")
    .eq("user_id", enrollment.guardian_id)
    .single()

  if (guardianProfile?.phone) {
    await queueSms({
      recipientPhone: guardianProfile.phone,
      messageBody: `Your enrollment application was rejected. Reasons: ${rejectionSummary}. Please log in to view details and resubmit.`,
      triggerEvent: "ENROLLMENT_REJECTED",
      relatedId: enrollmentId,
    })
  }

  await writeAuditLog({
    actorId: user.id,
    actorRole: userData.role,
    actionType: "ENROLLMENT_REJECTED",
    targetTable: "enrollments",
    targetId: enrollmentId,
    oldValue: { status: "PENDING_REVIEW" },
    newValue: {
      status: "REJECTED",
      rejection_summary: rejectionSummary,
      waitlist_promoted: promotionCandidate?.id ?? null,
    },
  })

  return NextResponse.json({
    success: true,
    status: "REJECTED",
    waitlistPromoted: !!promotionCandidate,
  })
}