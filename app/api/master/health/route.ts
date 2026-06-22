// app/api/master/health/route.ts
// Purpose: Aggregate system health metrics for Master Admin dashboard
// Who can call it: MASTER_ADMIN only

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { isMfaVerifiedInSession } from "@/lib/supabase/session"

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

  const mfaVerified = await isMfaVerifiedInSession(user.id)
  if (!mfaVerified) {
    return NextResponse.json(
      { error: "MFA verification required" },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(request.url)
  const academicYearId = searchParams.get("academicYearId")

  const now = new Date()
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [
    // Webhook health
    webhookFailuresResult,
    recentWebhooksResult,

    // SMS queue health
    smsFailedResult,
    smsPendingResult,

    // Payment claims
    pendingClaimsResult,
    oldestPendingClaimResult,

    // Enrollment counter
    billingCounterResult,

    // Flagged guardians (high expired_count)
    flaggedGuardiansResult,

    // Locked admin accounts
    lockedAdminsResult,

    // Recent audit log entries for context
    recentOverridesResult,
  ] = await Promise.all([
    // Webhook failures in last 24h
    adminClient
      .from("webhook_logs")
      .select("id", { count: "exact", head: true })
      .eq("signature_valid", false)
      .gte("created_at", last24h.toISOString()),

    // Total webhooks in last 24h
    adminClient
      .from("webhook_logs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", last24h.toISOString()),

    // SMS failed in last 7 days
    adminClient
      .from("sms_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "FAILED")
      .gte("created_at", last7d.toISOString()),

    // SMS pending
    adminClient
      .from("sms_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING"),

    // Pending manual payment claims
    adminClient
      .from("manual_payment_claims")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING"),

    // Oldest pending claim
    adminClient
      .from("manual_payment_claims")
      .select("created_at")
      .eq("status", "PENDING")
      .order("created_at", { ascending: true })
      .limit(1)
      .single(),

    // Billing counter for active academic year
    academicYearId
      ? adminClient
          .from("platform_billing_counter")
          .select("total_successful_enrollments, last_updated_at")
          .eq("academic_year_id", academicYearId)
          .single()
      : adminClient
          .from("platform_billing_counter")
          .select(
            "total_successful_enrollments, last_updated_at, academic_year_id"
          )
          .order("last_updated_at", { ascending: false })
          .limit(1)
          .single(),

    // Guardians with expired_count >= 2 (abuse flag threshold)
    adminClient
      .from("enrollments")
      .select(
        `
        guardian_id, expired_count,
        guardian_profiles!inner (full_name, phone),
        students!inner (stu_id, full_name)
      `
      )
      .gte("expired_count", 2)
      .order("expired_count", { ascending: false })
      .limit(20),

    // Locked admin accounts (MFA failed attempts — users with
    // is_locked = true if that column exists, else check last
    // failed login pattern via audit logs)
    adminClient
      .from("users")
      .select("id, email, full_name, role, updated_at")
      .in("role", ["BRANCH_ADMIN", "MASTER_ADMIN"])
      .eq("is_locked", true)
      .limit(20),

    // Recent manual overrides in last 7 days
    adminClient
      .from("audit_logs")
      .select("id, action_type, created_at, new_value")
      .eq("action_type", "ENROLLMENT_STATUS_OVERRIDE")
      .gte("created_at", last7d.toISOString())
      .order("created_at", { ascending: false })
      .limit(5),
  ])

  // Seat fill rates — per branch per grade for active year
  let seatFillRates: {
    branchName: string
    gradeName: string
    streamName: string | null
    totalSeats: number
    enrolledSeats: number
    reservedSeats: number
    pendingSeats: number
    available: number
    fillRate: number
  }[] = []

  if (academicYearId) {
    const { data: capacities } = await adminClient
      .from("grade_capacities")
      .select(`
        total_seats, pending_seats, reserved_seats, enrolled_seats,
        waitlist_count,
        branches!inner (name),
        grades!inner (name, level_order),
        streams (name)
      `)
      .eq("academic_year_id", academicYearId)

    seatFillRates = (capacities ?? [])
      .map((c) => {
        const branch = Array.isArray(c.branches)
          ? c.branches[0]
          : c.branches
        const grade = Array.isArray(c.grades)
          ? c.grades[0]
          : c.grades
        const stream = Array.isArray(c.streams)
          ? c.streams[0]
          : c.streams

        const available = Math.max(
          0,
          c.total_seats -
            c.pending_seats -
            c.reserved_seats -
            c.enrolled_seats
        )
        const fillRate =
          c.total_seats > 0
            ? parseFloat(
                (
                  ((c.enrolled_seats + c.reserved_seats) /
                    c.total_seats) *
                  100
                ).toFixed(1)
              )
            : 0

        return {
          branchName: branch?.name ?? "",
          gradeName: grade?.name ?? "",
          streamName: stream?.name ?? null,
          totalSeats: c.total_seats,
          enrolledSeats: c.enrolled_seats,
          reservedSeats: c.reserved_seats,
          pendingSeats: c.pending_seats,
          available,
          fillRate,
        }
      })
      .sort((a, b) => {
        if (a.branchName !== b.branchName)
          return a.branchName.localeCompare(b.branchName)
        return b.fillRate - a.fillRate
      })
  }

  const flaggedGuardians = (flaggedGuardiansResult.data ?? []).map(
    (e) => {
      const profile = Array.isArray(e.guardian_profiles)
        ? e.guardian_profiles[0]
        : e.guardian_profiles
      const student = Array.isArray(e.students)
        ? e.students[0]
        : e.students
      return {
        guardianId: e.guardian_id,
        guardianName: profile?.full_name ?? "Unknown",
        guardianPhone: profile?.phone ?? "",
        studentStuId: student?.stu_id ?? "",
        studentName: student?.full_name ?? "",
        expiredCount: e.expired_count,
      }
    }
  )

  return NextResponse.json({
    generatedAt: now.toISOString(),
    webhooks: {
      failuresLast24h: webhookFailuresResult.count ?? 0,
      totalLast24h: recentWebhooksResult.count ?? 0,
    },
    smsQueue: {
      failedLast7d: smsFailedResult.count ?? 0,
      pending: smsPendingResult.count ?? 0,
    },
    paymentClaims: {
      pendingCount: pendingClaimsResult.count ?? 0,
      oldestPendingAt:
        oldestPendingClaimResult.data?.created_at ?? null,
    },
    billingCounter: {
      totalEnrolled:
        billingCounterResult.data?.total_successful_enrollments ?? 0,
      lastUpdatedAt:
        billingCounterResult.data?.last_updated_at ?? null,
    },
    seatFillRates,
    flaggedGuardians,
    lockedAdmins: lockedAdminsResult.data ?? [],
    recentOverrides: recentOverridesResult.data ?? [],
  })
}