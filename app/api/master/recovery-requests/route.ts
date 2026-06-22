// app/api/master/recovery-requests/route.ts
// Purpose: List PENDING guardian recovery requests for Master Admin review
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
  const status = searchParams.get("status") ?? "PENDING"

  const { data: requests, error } = await adminClient
    .from("guardian_recovery_requests")
    .select(`
      id, claimed_full_name, claimed_phone, claimed_student_name,
      claimed_student_dob, recovery_reason, confidence_level,
      national_id_front_public_id, national_id_back_public_id,
      status, created_at,
      new_guardian_id,
      matched_guardian_id
    `)
    .eq("status", status)
    .order("confidence_level", { ascending: false })
    .order("created_at", { ascending: true })

  if (error) {
    console.error("[RecoveryRequests] Query error:", error)
    return NextResponse.json(
      { error: "Could not fetch recovery requests" },
      { status: 500 }
    )
  }

  // For each request, fetch the matched guardian profile and
  // check for recent activity on that account
  const enriched = await Promise.all(
    (requests ?? []).map(async (r) => {
      const [matchedGuardianResult, recentActivityResult] =
        await Promise.all([
          r.matched_guardian_id
            ? adminClient
                .from("guardian_profiles")
                .select("full_name, phone, residential_address, is_complete")
                .eq("user_id", r.matched_guardian_id)
                .single()
            : Promise.resolve({ data: null }),

          r.matched_guardian_id
            ? adminClient
                .from("enrollments")
                .select("id", { count: "exact", head: true })
                .eq("guardian_id", r.matched_guardian_id)
                .gte(
                  "updated_at",
                  new Date(
                    Date.now() - 30 * 24 * 60 * 60 * 1000
                  ).toISOString()
                )
            : Promise.resolve({ count: 0 }),
        ])

      return {
        id: r.id,
        claimedFullName: r.claimed_full_name,
        claimedPhone: r.claimed_phone,
        claimedStudentName: r.claimed_student_name,
        claimedStudentDob: r.claimed_student_dob,
        recoveryReason: r.recovery_reason,
        confidenceLevel: r.confidence_level,
        nationalIdFrontPublicId: r.national_id_front_public_id,
        nationalIdBackPublicId: r.national_id_back_public_id,
        status: r.status,
        createdAt: r.created_at,
        newGuardianId: r.new_guardian_id,
        matchedGuardianId: r.matched_guardian_id,
        matchedGuardianProfile: matchedGuardianResult.data ?? null,
        recentActivityCount: recentActivityResult.count ?? 0,
      }
    })
  )

  return NextResponse.json({ requests: enriched })
}