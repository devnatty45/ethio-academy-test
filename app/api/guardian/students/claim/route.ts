// app/api/guardian/students/claim/route.ts
// Purpose: Create a claim request when guardian identifies an existing
//          student with no active guardian link
// Who can call it: authenticated GUARDIAN with complete profile
// Rate limited: 5 per hour per IP (applied in proxy.ts already)

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isGuardianProfileComplete } from "@/lib/utils/guardian"
import { writeAuditLog } from "@/lib/utils/audit"

const claimSchema = z.object({
  matchedStudentId: z.string().uuid(),
  submittedName: z.string().min(2).max(100).trim(),
  submittedDob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  submittedGender: z.enum(["MALE", "FEMALE"]),
  confidenceScore: z.number().min(0).max(1),
})

export async function POST(request: NextRequest) {
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

  const profileComplete = await isGuardianProfileComplete(user.id)
  if (!profileComplete) {
    return NextResponse.json(
      { error: "Complete your profile before claiming a student" },
      { status: 403 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const result = claimSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const {
    matchedStudentId,
    submittedName,
    submittedDob,
    submittedGender,
    confidenceScore,
  } = result.data

  // Verify the student exists and is ACTIVE
  const { data: student } = await adminClient
    .from("students")
    .select("id, stu_id, full_name, status")
    .eq("id", matchedStudentId)
    .eq("status", "ACTIVE")
    .single()

  if (!student) {
    return NextResponse.json(
      { error: "Student not found" },
      { status: 404 }
    )
  }

  // Check if student already has an ACTIVE guardian link
  // If yes → this is Case 3 (silently blocked)
  const { data: activeLink } = await adminClient
    .from("guardian_student_links")
    .select("id")
    .eq("student_id", matchedStudentId)
    .eq("is_active", true)
    .eq("link_type", "PRIMARY")
    .single()

  if (activeLink) {
    // Case 3 — silently block, log the attempt
    await writeAuditLog({
      actorId: user.id,
      actorRole: "GUARDIAN",
      actionType: "STUDENT_CLAIM_BLOCKED_HAS_GUARDIAN",
      targetTable: "students",
      targetId: matchedStudentId,
      newValue: {
        attempted_by: user.id,
        student_stu_id: student.stu_id,
      },
    })

    // Check for repeated attempts — 3 in 7 days flags Master Admin
    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString()

    const { count: recentAttempts } = await adminClient
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("actor_id", user.id)
      .eq("action_type", "STUDENT_CLAIM_BLOCKED_HAS_GUARDIAN")
      .eq("target_id", matchedStudentId)
      .gte("created_at", sevenDaysAgo)

    if ((recentAttempts ?? 0) >= 3) {
      await writeAuditLog({
        actorId: user.id,
        actorRole: "GUARDIAN",
        actionType: "REPEATED_CLAIM_ATTEMPT_FLAGGED",
        targetTable: "students",
        targetId: matchedStudentId,
        newValue: {
          attempts_in_7_days: recentAttempts,
          guardian_id: user.id,
          student_stu_id: student.stu_id,
        },
      })
    }

    // Return neutral message — never reveal the existing guardian
    return NextResponse.json(
      {
        error:
          "This student record is already associated with a guardian account. If you believe this is an error, please contact the school directly.",
        blocked: true,
      },
      { status: 409 }
    )
  }

  // Check for existing PENDING claim by this guardian for this student
  const { data: existingClaim } = await adminClient
    .from("claim_requests")
    .select("id, status")
    .eq("claimed_guardian_id", user.id)
    .eq("matched_student_id", matchedStudentId)
    .eq("status", "PENDING")
    .single()

  if (existingClaim) {
    return NextResponse.json(
      {
        error:
          "You already have a pending claim for this student. Please wait for review.",
        claimId: existingClaim.id,
      },
      { status: 409 }
    )
  }

  // Create the claim request
  const { data: newClaim, error: claimError } = await adminClient
    .from("claim_requests")
    .insert({
      claimed_guardian_id: user.id,
      matched_student_id: matchedStudentId,
      confidence_score: confidenceScore,
      submitted_details: {
        submitted_name: submittedName,
        submitted_dob: submittedDob,
        submitted_gender: submittedGender,
      },
      status: "PENDING",
    })
    .select("id")
    .single()

  if (claimError || !newClaim) {
    return NextResponse.json(
      { error: "Could not submit claim" },
      { status: 500 }
    )
  }

  await writeAuditLog({
    actorId: user.id,
    actorRole: "GUARDIAN",
    actionType: "STUDENT_CLAIM_SUBMITTED",
    targetTable: "claim_requests",
    targetId: newClaim.id,
    newValue: {
      matched_student_id: matchedStudentId,
      student_stu_id: student.stu_id,
      confidence_score: confidenceScore,
    },
  })

  return NextResponse.json({
    success: true,
    claimId: newClaim.id,
    message:
      "Your claim has been submitted for review. You will be notified once it is processed.",
  })
}