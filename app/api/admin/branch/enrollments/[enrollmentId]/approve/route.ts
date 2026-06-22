// app/api/admin/branch/enrollments/[enrollmentId]/approve/route.ts
// Purpose: Approve an enrollment after all documents are VERIFIED
// Who can call it: BRANCH_ADMIN for their branch, MASTER_ADMIN for any

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isMfaVerifiedInSession } from "@/lib/supabase/session"
import { areAllDocumentsVerified } from "@/lib/utils/enrollment-review"
import { writeAuditLog } from "@/lib/utils/audit"
import { queueSms } from "@/lib/utils/sms"

const paramsSchema = z.object({ enrollmentId: z.string().uuid() })

const PAYMENT_WINDOW_HOURS = 48

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

  // Fetch enrollment
  const { data: enrollment } = await adminClient
    .from("enrollments")
    .select(
      "id, status, branch_id, grade_id, stream_id, academic_year_id, guardian_id, student_id"
    )
    .eq("id", enrollmentId)
    .single()

  if (!enrollment) {
    return NextResponse.json(
      { error: "Enrollment not found" },
      { status: 404 }
    )
  }

  // Branch admin branch check
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

  if (enrollment.status !== "PENDING_REVIEW") {
    return NextResponse.json(
      {
        error: `Cannot approve — enrollment is in ${enrollment.status} status`,
      },
      { status: 409 }
    )
  }

  // Server-side enforcement: ALL documents must be VERIFIED
  const allVerified = await areAllDocumentsVerified(enrollmentId)
  if (!allVerified) {
    return NextResponse.json(
      {
        error:
          "All documents must be VERIFIED before approving this enrollment",
      },
      { status: 409 }
    )
  }

  // Look up the active fee structure for this branch/grade/stream/year
  const { data: feeStructure } = await adminClient
    .from("fee_structures")
    .select("id, total_amount, registration_fee, first_month_fee")
    .eq("academic_year_id", enrollment.academic_year_id)
    .eq("branch_id", enrollment.branch_id)
    .eq("grade_id", enrollment.grade_id)
    .eq(
      "stream_id",
      enrollment.stream_id ?? "00000000-0000-0000-0000-000000000000"
    )
    .is("effective_until", null)
    .single()

  // Fallback: try without stream filter if stream_id is null
  let resolvedFeeStructure = feeStructure
  if (!resolvedFeeStructure && !enrollment.stream_id) {
    const { data: feeNoStream } = await adminClient
      .from("fee_structures")
      .select("id, total_amount, registration_fee, first_month_fee")
      .eq("academic_year_id", enrollment.academic_year_id)
      .eq("branch_id", enrollment.branch_id)
      .eq("grade_id", enrollment.grade_id)
      .is("stream_id", null)
      .is("effective_until", null)
      .single()
    resolvedFeeStructure = feeNoStream
  }

  if (!resolvedFeeStructure) {
    return NextResponse.json(
      {
        error:
          "No active fee structure found for this branch/grade/stream. Contact Master Admin.",
      },
      { status: 409 }
    )
  }

  // Atomically confirm the seat: pending → reserved
  const { error: seatError } = await adminClient.rpc(
    "confirm_pending_seat",
    {
      p_academic_year_id: enrollment.academic_year_id,
      p_branch_id: enrollment.branch_id,
      p_grade_id: enrollment.grade_id,
      p_stream_id: enrollment.stream_id,
    }
  )

  if (seatError) {
  console.error("confirm_pending_seat error:", seatError)

  return NextResponse.json(
    {
      error: "Could not confirm seat reservation",
      details: seatError.message,
    },
    { status: 500 }
  )
}

  const paymentDeadline = new Date(
    Date.now() + PAYMENT_WINDOW_HOURS * 60 * 60 * 1000
  )

  // Update enrollment: PENDING_REVIEW → PAYMENT_PENDING
  const { error: updateError } = await adminClient
  .from("enrollments")
  .update({
    status: "PAYMENT_PENDING",
    fee_structure_id: resolvedFeeStructure.id,
    payment_deadline_at: paymentDeadline.toISOString(),
    updated_at: new Date().toISOString(),
  })
  .eq("id", enrollmentId)

  if (updateError) {
  console.error("Enrollment update error:", updateError)

  return NextResponse.json(
    {
      error: "Could not update enrollment",
      details: updateError.message,
    },
    { status: 500 }
  )
}

  // Log transition
  await adminClient.from("enrollment_transitions").insert({
    enrollment_id: enrollmentId,
    from_status: "PENDING_REVIEW",
    to_status: "PAYMENT_PENDING",
    actor_id: user.id,
    actor_role: userData.role,
    reason: "All documents verified — approved by admin",
    metadata: {
      fee_structure_id: resolvedFeeStructure.id,
      total_amount: resolvedFeeStructure.total_amount,
      payment_deadline_at: paymentDeadline.toISOString(),
    },
  })

  // Release the soft lock now that decision is made
  await adminClient
    .from("enrollment_review_locks")
    .delete()
    .eq("enrollment_id", enrollmentId)

  // Queue SMS to guardian
  const { data: guardianProfile } = await adminClient
    .from("guardian_profiles")
    .select("phone")
    .eq("user_id", enrollment.guardian_id)
    .single()

  if (guardianProfile?.phone) {
    await queueSms({
      recipientPhone: guardianProfile.phone,
      messageBody: `Your enrollment application has been approved. Payment of ${resolvedFeeStructure.total_amount} ETB is due within ${PAYMENT_WINDOW_HOURS} hours. Please log in to complete payment.`,
      triggerEvent: "ENROLLMENT_APPROVED",
      relatedId: enrollmentId,
    })
  }

  await writeAuditLog({
    actorId: user.id,
    actorRole: userData.role,
    actionType: "ENROLLMENT_APPROVED",
    targetTable: "enrollments",
    targetId: enrollmentId,
    oldValue: { status: "PENDING_REVIEW" },
    newValue: {
      status: "PAYMENT_PENDING",
      fee_structure_id: resolvedFeeStructure.id,
      total_amount: resolvedFeeStructure.total_amount,
      payment_deadline_at: paymentDeadline.toISOString(),
    },
  })

  return NextResponse.json({
    success: true,
    status: "PAYMENT_PENDING",
    paymentDeadlineAt: paymentDeadline.toISOString(),
    totalAmount: resolvedFeeStructure.total_amount,
  })
}