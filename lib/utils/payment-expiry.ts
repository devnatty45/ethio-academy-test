// lib/utils/payment-expiry.ts
// Sweeps PAYMENT_PENDING enrollments whose deadline has passed
// Expires them, releases the reserved seat, and promotes the next
// waitlisted guardian if one exists
// Designed to be called repeatedly and safely (idempotent)

import { createAdminClient } from "@/lib/supabase/admin"
import { queueSms } from "@/lib/utils/sms"

export async function sweepExpiredPayments(): Promise<{
  expiredCount: number
  promotedCount: number
}> {
  const adminClient = createAdminClient()
  const now = new Date().toISOString()

  // ==========================================
  // ⏳ PHASE 1: 6-HOUR PROACTIVE WARNING PASS
  // ==========================================
  const sixHoursFromNow = new Date(
    Date.now() + 6 * 60 * 60 * 1000
  ).toISOString()

  const { data: warningSoon } = await adminClient
    .from("enrollments")
    .select("id, guardian_id, payment_deadline_at")
    .eq("status", "PAYMENT_PENDING")
    .lt("payment_deadline_at", sixHoursFromNow)
    .gt("payment_deadline_at", now)

  for (const enrollment of warningSoon ?? []) {
    // Only send warning once — check sms_queue for an existing warning record
    const { count: recentWarning } = await adminClient
      .from("sms_queue")
      .select("id", { count: "exact", head: true })
      .eq("related_id", enrollment.id)
      .eq("trigger_event", "PAYMENT_EXPIRY_WARNING")

    if ((recentWarning ?? 0) === 0) {
      const { data: profile } = await adminClient
        .from("guardian_profiles")
        .select("phone")
        .eq("user_id", enrollment.guardian_id)
        .single()

      if (profile?.phone) {
        try {
          await queueSms({
            recipientPhone: profile.phone,
            messageBody:
              "Reminder: Your enrollment payment deadline is approaching in less than 6 hours. Please complete your payment to secure your child's seat.",
            triggerEvent: "PAYMENT_EXPIRY_WARNING",
            relatedId: enrollment.id,
          })
        } catch (smsErr) {
          console.error(`[Sweep] Failed to queue warning SMS for enrollment ${enrollment.id}:`, smsErr)
        }
      }
    }
  }

  // ==========================================
  // 🛑 PHASE 2: CRITICAL EXPIRED SWEEP PASS
  // ==========================================
  const { data: expiredPayments } = await adminClient
    .from("enrollments")
    .select(
      "id, guardian_id, branch_id, grade_id, stream_id, academic_year_id, expired_count"
    )
    .eq("status", "PAYMENT_PENDING")
    .lt("payment_deadline_at", now)

  let expiredCount = 0
  let promotedCount = 0

  for (const enrollment of expiredPayments ?? []) {
    // Release the reserved seat (it was moved from pending → reserved at approval)
    await adminClient.rpc("release_reserved_seat", {
      p_academic_year_id: enrollment.academic_year_id,
      p_branch_id: enrollment.branch_id,
      p_grade_id: enrollment.grade_id,
      p_stream_id: enrollment.stream_id,
    })

    await adminClient
      .from("enrollments")
      .update({
        status: "EXPIRED",
        expired_count: (enrollment.expired_count ?? 0) + 1,
        updated_at: now,
      })
      .eq("id", enrollment.id)

    await adminClient.from("enrollment_transitions").insert({
      enrollment_id: enrollment.id,
      from_status: "PAYMENT_PENDING",
      to_status: "EXPIRED",
      actor_id: null,
      actor_role: "SYSTEM",
      reason: "Payment deadline passed without confirmation",
    })

    expiredCount++

    // Mark any still-PENDING payment record as EXPIRED too
    await adminClient
      .from("payments")
      .update({ status: "EXPIRED", updated_at: now })
      .eq("enrollment_id", enrollment.id)
      .eq("status", "PENDING")

    // Notify the guardian
    const { data: profile } = await adminClient
      .from("guardian_profiles")
      .select("phone")
      .eq("user_id", enrollment.guardian_id)
      .single()

    if (profile?.phone) {
      try {
        await queueSms({
          recipientPhone: profile.phone,
          messageBody:
            "Your enrollment payment deadline has passed and your seat reservation has expired. Please contact the school or submit a new application.",
          triggerEvent: "PAYMENT_EXPIRED",
          relatedId: enrollment.id,
        })
      } catch (smsErr) {
        console.error(`[Sweep] Failed to queue expiry SMS for enrollment ${enrollment.id}:`, smsErr)
      }
    }

    // Check waitlist promotion — a seat just freed up
    const { data: nextInLine } = await adminClient
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

    let candidate = nextInLine
    if (!candidate && !enrollment.stream_id) {
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
      candidate = candidateNoStream
    }

    if (candidate) {
      const notifyDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000)

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
        reason: "Promoted after a PAYMENT_PENDING enrollment expired",
      })

      const { data: candidateProfile } = await adminClient
        .from("guardian_profiles")
        .select("phone")
        .eq("user_id", candidate.guardian_id)
        .single()

      if (candidateProfile?.phone) {
        try {
          await queueSms({
            recipientPhone: candidateProfile.phone,
            messageBody:
              "A seat has become available. You have 24 hours to confirm your enrollment. Please log in to confirm.",
            triggerEvent: "WAITLIST_PROMOTED",
            relatedId: candidate.id,
          })
        } catch (smsErr) {
          console.error(`[Sweep] Failed to queue waitlist promotion SMS for enrollment ${candidate.id}:`, smsErr)
        }
      }

      promotedCount++
    }
  }

  return { expiredCount, promotedCount }
}