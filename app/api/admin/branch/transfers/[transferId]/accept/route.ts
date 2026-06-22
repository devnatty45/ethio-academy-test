// app/api/admin/branch/transfers/[transferId]/accept/route.ts
// Purpose: Target branch admin accepts an incoming transfer
// Who can call it: BRANCH_ADMIN of target branch, MASTER_ADMIN (force-accept)

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isMfaVerifiedInSession } from "@/lib/supabase/session"
import { writeAuditLog } from "@/lib/utils/audit"
import { queueSms } from "@/lib/utils/sms"

const paramsSchema = z.object({ transferId: z.string().uuid() })

const acceptSchema = z.object({
  forceAccept: z.boolean().optional().default(false),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ transferId: string }> }
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

  const { transferId } = paramsResult.data

  let body: unknown = {}
  try {
    body = await request.json()
  } catch {
    // No body is fine — defaults apply
  }

  const parsed = acceptSchema.safeParse(body)
  const forceAccept = parsed.success ? parsed.data.forceAccept : false

  if (forceAccept && userData.role !== "MASTER_ADMIN") {
    return NextResponse.json(
      { error: "Only Master Admin can force-accept a transfer" },
      { status: 403 }
    )
  }

  const { data: transfer } = await adminClient
    .from("enrollment_transfers")
    .select(
      "id, enrollment_id, from_branch_id, to_branch_id, status"
    )
    .eq("id", transferId)
    .single()

  if (!transfer) {
    return NextResponse.json(
      { error: "Transfer not found" },
      { status: 404 }
    )
  }

  if (transfer.status !== "PENDING_ACCEPTANCE") {
    return NextResponse.json(
      { error: `Cannot accept — transfer is in ${transfer.status} status` },
      { status: 409 }
    )
  }

  if (userData.role === "BRANCH_ADMIN") {
    const { data: adminProfile } = await adminClient
      .from("admin_profiles")
      .select("assigned_branch_id")
      .eq("user_id", user.id)
      .single()

    if (adminProfile?.assigned_branch_id !== transfer.to_branch_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  const { data: enrollment } = await adminClient
    .from("enrollments")
    .select("id, grade_id, academic_year_id, guardian_id, status")
    .eq("id", transfer.enrollment_id)
    .single()

  if (!enrollment) {
    return NextResponse.json(
      { error: "Enrollment not found" },
      { status: 404 }
    )
  }

  // Atomic seat check at target branch
  const { data: seatClaimed, error: seatError } = await adminClient.rpc(
    "claim_transfer_seat",
    {
      p_academic_year_id: enrollment.academic_year_id,
      p_branch_id: transfer.to_branch_id,
      p_grade_id: enrollment.grade_id,
    }
  )

  if (seatError) {
    return NextResponse.json(
      { error: "Could not process seat claim" },
      { status: 500 }
    )
  }

  if (!seatClaimed) {
    return NextResponse.json(
      { error: "No seats available — cannot accept transfer" },
      { status: 409 }
    )
  }

  // Release seat at origin branch
  await adminClient.rpc("release_transfer_origin_seat", {
    p_academic_year_id: enrollment.academic_year_id,
    p_branch_id: transfer.from_branch_id,
    p_grade_id: enrollment.grade_id,
  })

  // Reset all document verification statuses to PENDING — target admin
  // must re-verify independently
  await adminClient
    .from("enrollment_documents")
    .update({
      verification_status: "PENDING",
      rejection_reason_id: null,
      rejection_note: null,
      verified_by: null,
      verified_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("enrollment_id", transfer.enrollment_id)

  // Update enrollment branch and status
  await adminClient
    .from("enrollments")
    .update({
      branch_id: transfer.to_branch_id,
      status: "PENDING_REVIEW",
      updated_at: new Date().toISOString(),
    })
    .eq("id", transfer.enrollment_id)

  const now = new Date().toISOString()

  // Update transfer record
  await adminClient
    .from("enrollment_transfers")
    .update({
      status: "ACCEPTED",
      reviewed_by: user.id,
      force_accepted: forceAccept,
      force_accept_mfa_verified_at: forceAccept ? now : null,
      updated_at: now,
    })
    .eq("id", transferId)

  await adminClient.from("enrollment_transitions").insert({
    enrollment_id: transfer.enrollment_id,
    from_status: "TRANSFER_PENDING",
    to_status: "PENDING_REVIEW",
    actor_id: user.id,
    actor_role: userData.role,
    reason: forceAccept
      ? "Transfer force-accepted by Master Admin"
      : "Transfer accepted by target branch admin",
    metadata: { transfer_id: transferId, force_accepted: forceAccept },
  })

  await writeAuditLog({
    actorId: user.id,
    actorRole: userData.role,
    actionType: forceAccept
      ? "TRANSFER_FORCE_ACCEPTED"
      : "TRANSFER_ACCEPTED",
    targetTable: "enrollment_transfers",
    targetId: transferId,
    newValue: {
      enrollment_id: transfer.enrollment_id,
      to_branch_id: transfer.to_branch_id,
      force_accepted: forceAccept,
      mfa_verified_at: forceAccept ? now : null,
    },
  })

  const { data: targetBranch } = await adminClient
    .from("branches")
    .select("name")
    .eq("id", transfer.to_branch_id)
    .single()

  const { data: guardianProfile } = await adminClient
    .from("guardian_profiles")
    .select("phone")
    .eq("user_id", enrollment.guardian_id)
    .single()

  if (guardianProfile?.phone) {
    await queueSms({
      recipientPhone: guardianProfile.phone,
      messageBody: `Your enrollment has been transferred to ${targetBranch?.name ?? "the new branch"}. Your documents are now under review.`,
      triggerEvent: "TRANSFER_ACCEPTED",
      relatedId: transfer.enrollment_id,
    })
  }

  return NextResponse.json({ success: true })
}