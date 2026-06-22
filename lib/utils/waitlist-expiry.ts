// lib/utils/waitlist-expiry.ts
// Sweeps WAITLIST_NOTIFIED enrollments whose deadline has passed
// Expires them and promotes the next person in line
// Designed to be called repeatedly and safely (idempotent)

import { createAdminClient } from "@/lib/supabase/admin"
import { queueSms } from "@/lib/utils/sms"

export async function sweepExpiredWaitlistOffers(): Promise<{
  expiredCount: number
  promotedCount: number
}> {
  const adminClient = createAdminClient()
  const now = new Date().toISOString()

  const { data: expiredOffers } = await adminClient
    .from("enrollments")
    .select(
      "id, guardian_id, branch_id, grade_id, stream_id, academic_year_id"
    )
    .eq("status", "WAITLIST_NOTIFIED")
    .lt("waitlist_notify_deadline_at", now)

  let expiredCount = 0
  let promotedCount = 0

  for (const offer of expiredOffers ?? []) {
    // Release the waitlist slot for the expired offer
    await adminClient.rpc("expire_waitlist_offer", {
      p_academic_year_id: offer.academic_year_id,
      p_branch_id: offer.branch_id,
      p_grade_id: offer.grade_id,
      p_stream_id: offer.stream_id,
    })

    await adminClient
      .from("enrollments")
      .update({
        status: "WAITLIST_EXPIRED",
        waitlist_notify_deadline_at: null,
        updated_at: now,
      })
      .eq("id", offer.id)

    await adminClient.from("enrollment_transitions").insert({
      enrollment_id: offer.id,
      from_status: "WAITLIST_NOTIFIED",
      to_status: "WAITLIST_EXPIRED",
      actor_id: null,
      actor_role: "SYSTEM",
      reason: "24-hour confirmation window expired without response",
    })

    expiredCount++

    // Promote the next person in line for this exact branch/grade/stream
    const { data: nextInLine } = await adminClient
      .from("enrollments")
      .select("id, guardian_id")
      .eq("academic_year_id", offer.academic_year_id)
      .eq("branch_id", offer.branch_id)
      .eq("grade_id", offer.grade_id)
      .eq(
        "stream_id",
        offer.stream_id ?? "00000000-0000-0000-0000-000000000000"
      )
      .eq("status", "WAITLISTED")
      .order("waitlisted_at", { ascending: true })
      .limit(1)
      .single()

    let candidate = nextInLine
    if (!candidate && !offer.stream_id) {
      const { data: candidateNoStream } = await adminClient
        .from("enrollments")
        .select("id, guardian_id")
        .eq("academic_year_id", offer.academic_year_id)
        .eq("branch_id", offer.branch_id)
        .eq("grade_id", offer.grade_id)
        .is("stream_id", null)
        .eq("status", "WAITLISTED")
        .order("waitlisted_at", { ascending: true })
        .limit(1)
        .single()
      candidate = candidateNoStream
    }

    if (candidate) {
      const notifyDeadline = new Date(
        Date.now() + 24 * 60 * 60 * 1000
      )

      await adminClient
        .from("enrollments")
        .update({
          status: "WAITLIST_NOTIFIED",
          waitlist_notify_deadline_at: notifyDeadline.toISOString(),
          updated_at: now,
        })
        .eq("id", candidate.id)

      await adminClient.from("enrollment_transitions").insert({
        enrollment_id: candidate.id,
        from_status: "WAITLISTED",
        to_status: "WAITLIST_NOTIFIED",
        actor_id: null,
        actor_role: "SYSTEM",
        reason: "Promoted after previous offer expired",
      })

      const { data: profile } = await adminClient
        .from("guardian_profiles")
        .select("phone")
        .eq("user_id", candidate.guardian_id)
        .single()

      if (profile?.phone) {
        await queueSms({
          recipientPhone: profile.phone,
          messageBody:
            "A seat has become available. You have 24 hours to confirm your enrollment. Please log in to confirm.",
          triggerEvent: "WAITLIST_PROMOTED",
          relatedId: candidate.id,
        })
      }

      promotedCount++
    }
  }

  return { expiredCount, promotedCount }
}