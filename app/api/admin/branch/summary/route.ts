// app/api/admin/branch/summary/route.ts
// Purpose: Get today's activity counts for the admin's branch
// Who can call it: BRANCH_ADMIN for own branch, MASTER_ADMIN for any

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

  const { searchParams } = new URL(request.url)
  let branchId = searchParams.get("branchId")

  if (userData.role === "BRANCH_ADMIN") {
    const { data: adminProfile } = await adminClient
      .from("admin_profiles")
      .select("assigned_branch_id")
      .eq("user_id", user.id)
      .single()
    branchId = adminProfile?.assigned_branch_id ?? null
  }

  if (!branchId) {
    return NextResponse.json(
      { error: "No branch specified" },
      { status: 400 }
    )
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [
    pendingReview,
    approvedToday,
    rejectedToday,
    paymentPending,
    waitlisted,
    enrolledToday,
  ] = await Promise.all([
    adminClient
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", branchId)
      .eq("status", "PENDING_REVIEW"),
    adminClient
      .from("enrollment_transitions")
      .select("enrollment_id, enrollments!inner(branch_id)", {
        count: "exact",
        head: true,
      })
      .eq("to_status", "PAYMENT_PENDING")
      .eq("enrollments.branch_id", branchId)
      .gte("created_at", todayStart.toISOString()),
    adminClient
      .from("enrollment_transitions")
      .select("enrollment_id, enrollments!inner(branch_id)", {
        count: "exact",
        head: true,
      })
      .eq("to_status", "REJECTED")
      .eq("enrollments.branch_id", branchId)
      .gte("created_at", todayStart.toISOString()),
    adminClient
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", branchId)
      .eq("status", "PAYMENT_PENDING"),
    adminClient
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", branchId)
      .eq("status", "WAITLISTED"),
    adminClient
      .from("enrollment_transitions")
      .select("enrollment_id, enrollments!inner(branch_id)", {
        count: "exact",
        head: true,
      })
      .eq("to_status", "ENROLLED")
      .eq("enrollments.branch_id", branchId)
      .gte("created_at", todayStart.toISOString()),
  ])

  return NextResponse.json({
    branchId,
    date: todayStart.toISOString(),
    counts: {
      pendingReview: pendingReview.count ?? 0,
      approvedToday: approvedToday.count ?? 0,
      rejectedToday: rejectedToday.count ?? 0,
      paymentPending: paymentPending.count ?? 0,
      waitlisted: waitlisted.count ?? 0,
      enrolledToday: enrolledToday.count ?? 0,
    },
  })
}