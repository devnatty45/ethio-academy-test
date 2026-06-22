// app/api/admin/branch/transfers/[transferId]/reject/route.ts
// Purpose: Target branch admin rejects an incoming transfer
// Who can call it: BRANCH_ADMIN of target branch, MASTER_ADMIN

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isMfaVerifiedInSession } from "@/lib/supabase/session"
import { writeAuditLog } from "@/lib/utils/audit"
import { queueSms } from "@/lib/utils/sms"

const paramsSchema = z.object({ transferId: z.string().uuid() })

const rejectSchema = z.object({
  rejectionReason: z.string().min(5).max(500),
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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const parsed = rejectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { rejectionReason } = parsed.data

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
      { error: `Cannot reject — transfer is in ${transfer.status} status` },
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
    .select("id, guardian_id")
    .eq("id", transfer.enrollment_id)
    .single()

  // Enrollment returns to PENDING_REVIEW at the ORIGINAL branch —
  // branch_id was never changed during initiation, so no update needed there
  await adminClient
    .from("enrollments")
    .update({
      status: "PENDING_REVIEW",
      updated_at: new Date().toISOString(),
    })
    .eq("id", transfer.enrollment_id)

  await adminClient
    .from("enrollment_transfers")
    .update({
      status: "REJECTED",
      reviewed_by: user.id,
      rejection_reason: rejectionReason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", transferId)

  await adminClient.from("enrollment_transitions").insert({
    enrollment_id: transfer.enrollment_id,
    from_status: "TRANSFER_PENDING",
    to_status: "PENDING_REVIEW",
    actor_id: user.id,
    actor_role: userData.role,
    reason: `Transfer rejected: ${rejectionReason}`,
    metadata: { transfer_id: transferId },
  })

  await writeAuditLog({
    actorId: user.id,
    actorRole: userData.role,
    actionType: "TRANSFER_REJECTED",
    targetTable: "enrollment_transfers",
    targetId: transferId,
    newValue: { rejection_reason: rejectionReason },
  })

  const [originBranch, guardianProfile] = await Promise.all([
    adminClient
      .from("branches")
      .select("name")
      .eq("id", transfer.from_branch_id)
      .single(),
    adminClient
      .from("guardian_profiles")
      .select("phone")
      .eq("user_id", enrollment?.guardian_id)
      .single(),
  ])

  const { data: targetBranch } = await adminClient
    .from("branches")
    .select("name")
    .eq("id", transfer.to_branch_id)
    .single()

  if (guardianProfile.data?.phone) {
    await queueSms({
      recipientPhone: guardianProfile.data.phone,
      messageBody: `Transfer to ${targetBranch?.name ?? "the requested branch"} could not be completed — ${rejectionReason}. Your enrollment remains active at ${originBranch.data?.name ?? "your original branch"}.`,
      triggerEvent: "TRANSFER_REJECTED",
      relatedId: transfer.enrollment_id,
    })
  }

  return NextResponse.json({ success: true })
}