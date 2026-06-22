// app/api/admin/branch/transfers/route.ts
// Purpose: List incoming transfer requests for the admin's branch
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

  const { data: transfers } = await adminClient
    .from("enrollment_transfers")
    .select(`
      id, initiation_reason, status, created_at,
      from_branch_id,
      branches!enrollment_transfers_from_branch_id_fkey (name),
      enrollments!inner (
        id, grade_id, academic_year_id,
        students!inner (stu_id, full_name, date_of_birth),
        grades!inner (name)
      )
    `)
    .eq("to_branch_id", branchId)
    .eq("status", "PENDING_ACCEPTANCE")
    .order("created_at", { ascending: true })

  // For each transfer, get seat availability at this branch for that grade
  const enriched = await Promise.all(
    (transfers ?? []).map(async (t) => {
      const enrollment = Array.isArray(t.enrollments)
        ? t.enrollments[0]
        : t.enrollments
      const fromBranch = Array.isArray(t.branches)
        ? t.branches[0]
        : t.branches

      const { data: capacity } = await adminClient
        .from("grade_capacities")
        .select(
          "total_seats, pending_seats, reserved_seats, enrolled_seats"
        )
        .eq("branch_id", branchId)
        .eq("grade_id", enrollment?.grade_id)
        .eq("academic_year_id", enrollment?.academic_year_id)
        .is("stream_id", null)
        .single()

      const available = capacity
        ? capacity.total_seats -
          capacity.pending_seats -
          capacity.reserved_seats -
          capacity.enrolled_seats
        : 0

      const student = Array.isArray(enrollment?.students)
        ? enrollment.students[0]
        : enrollment?.students
      const grade = Array.isArray(enrollment?.grades)
        ? enrollment.grades[0]
        : enrollment?.grades

      return {
        id: t.id,
        reason: t.initiation_reason,
        createdAt: t.created_at,
        fromBranchName: fromBranch?.name,
        enrollmentId: enrollment?.id,
        student,
        gradeName: grade?.name,
        availableSeats: Math.max(0, available),
      }
    })
  )

  return NextResponse.json({ transfers: enriched })
}