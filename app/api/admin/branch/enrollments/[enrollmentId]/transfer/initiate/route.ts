// app/api/admin/branch/enrollments/[enrollmentId]/transfer/initiate/route.ts
// Purpose: Initiate a branch transfer for an enrollment
// Who can call it: BRANCH_ADMIN for own branch, MASTER_ADMIN for any

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isMfaVerifiedInSession } from "@/lib/supabase/session"
import { writeAuditLog } from "@/lib/utils/audit"
import { queueSms } from "@/lib/utils/sms"

const paramsSchema = z.object({ enrollmentId: z.string().uuid() })

const initiateSchema = z.object({
  toBranchId: z.string().uuid(),
  reason: z.string().min(20).max(500),
})

const TRANSFER_ALLOWED_STATUSES = ["PENDING_REVIEW", "REJECTED"]

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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const parsed = initiateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { toBranchId, reason } = parsed.data

  const { data: enrollment } = await adminClient
    .from("enrollments")
    .select(
      "id, status, branch_id, guardian_id, grade_id, academic_year_id"
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

  if (toBranchId === enrollment.branch_id) {
    return NextResponse.json(
      { error: "Target branch must be different from current branch" },
      { status: 400 }
    )
  }

  if (!TRANSFER_ALLOWED_STATUSES.includes(enrollment.status)) {
    return NextResponse.json(
      {
        error: `Cannot transfer — enrollment status is ${enrollment.status}. Only PENDING_REVIEW or REJECTED enrollments can be transferred.`,
      },
      { status: 409 }
    )
  }

  // Check no active transfer already exists
  const { data: existingTransfer } = await adminClient
    .from("enrollment_transfers")
    .select("id")
    .eq("enrollment_id", enrollmentId)
    .eq("status", "PENDING_ACCEPTANCE")
    .single()

  if (existingTransfer) {
    return NextResponse.json(
      { error: "A transfer is already pending for this enrollment" },
      { status: 409 }
    )
  }

  // Verify target branch exists and is active
  const { data: targetBranch } = await adminClient
    .from("branches")
    .select("id, name, is_active")
    .eq("id", toBranchId)
    .single()

  if (!targetBranch || !targetBranch.is_active) {
    return NextResponse.json(
      { error: "Target branch not found or inactive" },
      { status: 404 }
    )
  }

  const previousStatus = enrollment.status

  // Create transfer record
  const { data: newTransfer, error: insertError } = await adminClient
    .from("enrollment_transfers")
    .insert({
      enrollment_id: enrollmentId,
      from_branch_id: enrollment.branch_id,
      to_branch_id: toBranchId,
      initiated_by: user.id,
      initiated_by_role: userData.role,
      initiation_reason: reason,
      status: "PENDING_ACCEPTANCE",
    })
    .select("id")
    .single()

  if (insertError || !newTransfer) {
    return NextResponse.json(
      { error: "Could not create transfer request" },
      { status: 500 }
    )
  }

  // Update enrollment status
  const { error: updateError } = await adminClient
    .from("enrollments")
    .update({
      status: "TRANSFER_PENDING",
      updated_at: new Date().toISOString(),
    })
    .eq("id", enrollmentId)

  if (updateError) {
    // Roll back transfer record
    await adminClient
      .from("enrollment_transfers")
      .delete()
      .eq("id", newTransfer.id)
    return NextResponse.json(
      { error: "Could not update enrollment status" },
      { status: 500 }
    )
  }

  await adminClient.from("enrollment_transitions").insert({
    enrollment_id: enrollmentId,
    from_status: previousStatus,
    to_status: "TRANSFER_PENDING",
    actor_id: user.id,
    actor_role: userData.role,
    reason: `Transfer initiated to ${targetBranch.name}: ${reason}`,
    metadata: {
      transfer_id: newTransfer.id,
      from_branch_id: enrollment.branch_id,
      to_branch_id: toBranchId,
    },
  })

  await writeAuditLog({
    actorId: user.id,
    actorRole: userData.role,
    actionType: "TRANSFER_INITIATED",
    targetTable: "enrollment_transfers",
    targetId: newTransfer.id,
    newValue: {
      enrollment_id: enrollmentId,
      from_branch_id: enrollment.branch_id,
      to_branch_id: toBranchId,
      reason,
    },
  })

  const { data: guardianProfile } = await adminClient
    .from("guardian_profiles")
    .select("phone")
    .eq("user_id", enrollment.guardian_id)
    .single()

  if (guardianProfile?.phone) {
    await queueSms({
      recipientPhone: guardianProfile.phone,
      messageBody: `Your enrollment is being transferred to ${targetBranch.name}. You will be notified of the outcome.`,
      triggerEvent: "TRANSFER_INITIATED",
      relatedId: enrollmentId,
    })
  }

  return NextResponse.json({ success: true, transferId: newTransfer.id })
}