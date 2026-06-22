// app/api/master/claim-requests/route.ts
// Purpose: List student claim requests for Master Admin review
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

  const { data: claims, error } = await adminClient
    .from("claim_requests")
    .select(`
      id, confidence_score, submitted_details, status,
      rejection_reason, created_at,
      claimed_guardian_id,
      matched_student_id
    `)
    .eq("status", status)
    .order("confidence_score", { ascending: false })
    .order("created_at", { ascending: true })

  if (error) {
    console.error("[ClaimRequests] Query error:", error)
    return NextResponse.json(
      { error: "Could not fetch claim requests" },
      { status: 500 }
    )
  }

  // Enrich each claim with guardian profile and matched student info
  const enriched = await Promise.all(
    (claims ?? []).map(async (c) => {
      const [guardianResult, studentResult, enrollmentResult] =
        await Promise.all([
          // Guardian who is making the claim
          adminClient
            .from("guardian_profiles")
            .select("full_name, phone")
            .eq("user_id", c.claimed_guardian_id)
            .single(),

          // The matched student
          adminClient
            .from("students")
            .select(
              "id, stu_id, full_name, date_of_birth, gender, status"
            )
            .eq("id", c.matched_student_id)
            .single(),

          // Student's enrollment history for context
          adminClient
            .from("enrollments")
            .select(`
              id, status, academic_result,
              branches!inner (name),
              grades!inner (name),
              academic_years!inner (name)
            `)
            .eq("student_id", c.matched_student_id)
            .order("submitted_at", { ascending: false })
            .limit(5),
        ])

      // Check if this guardian is already linked to this student
      const { data: existingLink } = await adminClient
        .from("guardian_student_links")
        .select("id, link_type, is_active")
        .eq("guardian_id", c.claimed_guardian_id)
        .eq("student_id", c.matched_student_id)
        .single()

      const enrollmentHistory = (
        enrollmentResult.data ?? []
      ).map((e) => {
        const branch = Array.isArray(e.branches)
          ? e.branches[0]
          : e.branches
        const grade = Array.isArray(e.grades)
          ? e.grades[0]
          : e.grades
        const year = Array.isArray(e.academic_years)
          ? e.academic_years[0]
          : e.academic_years
        return {
          id: e.id,
          status: e.status,
          academicResult: e.academic_result,
          branchName: branch?.name,
          gradeName: grade?.name,
          yearName: year?.name,
        }
      })

      return {
        id: c.id,
        confidenceScore: c.confidence_score,
        submittedDetails: c.submitted_details,
        status: c.status,
        rejectionReason: c.rejection_reason,
        createdAt: c.created_at,
        claimedGuardianId: c.claimed_guardian_id,
        matchedStudentId: c.matched_student_id,
        guardianProfile: guardianResult.data ?? null,
        matchedStudent: studentResult.data ?? null,
        enrollmentHistory,
        existingLink: existingLink ?? null,
      }
    })
  )

  return NextResponse.json({ claims: enriched })
}