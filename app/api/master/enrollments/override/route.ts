// app/api/master/enrollments/override/route.ts
// Purpose: Master Admin manually overrides enrollment status
// MFA re-verification required. Full capacity adjustment. Full audit log.
// Who can call it: MASTER_ADMIN only

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isMfaVerifiedInSession } from "@/lib/supabase/session"
import { writeAuditLog } from "@/lib/utils/audit"
import { VALID_MANUAL_TRANSITIONS } from "@/lib/utils/enrollment-transitions"
import type { EnrollmentStatus } from "@/lib/utils/enrollment-transitions"

const overrideSchema = z.object({
  enrollmentId: z.string().uuid(),
  toStatus: z.string(),
  reason: z.string().min(20).max(1000),
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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const parsed = overrideSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { enrollmentId, toStatus, reason } = parsed.data

  const { data: enrollment } = await adminClient
    .from("enrollments")
    .select(
      "id, status, branch_id, grade_id, stream_id, academic_year_id"
    )
    .eq("id", enrollmentId)
    .single()

  if (!enrollment) {
    return NextResponse.json(
      { error: "Enrollment not found" },
      { status: 404 }
    )
  }

  const fromStatus = enrollment.status as EnrollmentStatus
  const validTransitions = VALID_MANUAL_TRANSITIONS[fromStatus] ?? []
  const transition = validTransitions.find((t) => t.to === toStatus)

  if (!transition) {
    return NextResponse.json(
      {
        error: `Cannot transition from ${fromStatus} to ${toStatus}`,
        validTransitions: validTransitions.map((t) => t.to),
      },
      { status: 409 }
    )
  }

  // Apply capacity adjustment
  if (transition.capacityAction !== "none") {
    const { error: capacityError } = await adminClient.rpc(
      "adjust_capacity_for_override",
      {
        p_academic_year_id: enrollment.academic_year_id,
        p_branch_id: enrollment.branch_id,
        p_grade_id: enrollment.grade_id,
        p_stream_id: enrollment.stream_id,
        p_action: transition.capacityAction,
      }
    )

    if (capacityError) {
      console.error(
        "[EnrollmentOverride] Capacity adjustment error:",
        capacityError
      )
      return NextResponse.json(
        { error: "Could not adjust capacity" },
        { status: 500 }
      )
    }
  }

  // Special case: if overriding to ENROLLED, also increment billing counter
  if (toStatus === "ENROLLED") {
    await adminClient.rpc("increment_billing_counter", {
      p_academic_year_id: enrollment.academic_year_id,
    })
  }

  const { error: updateError } = await adminClient
    .from("enrollments")
    .update({
      status: toStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", enrollmentId)

  if (updateError) {
    console.error("[EnrollmentOverride] Update error:", updateError)
    return NextResponse.json(
      { error: "Could not update enrollment status" },
      { status: 500 }
    )
  }

  await adminClient.from("enrollment_transitions").insert({
    enrollment_id: enrollmentId,
    from_status: fromStatus,
    to_status: toStatus,
    actor_id: user.id,
    actor_role: "MASTER_ADMIN",
    reason: `[MANUAL OVERRIDE] ${reason}`,
    metadata: { capacity_action: transition.capacityAction },
  })

  await writeAuditLog({
    actorId: user.id,
    actorRole: "MASTER_ADMIN",
    actionType: "ENROLLMENT_STATUS_OVERRIDE",
    targetTable: "enrollments",
    targetId: enrollmentId,
    oldValue: { status: fromStatus },
    newValue: {
      status: toStatus,
      reason,
      capacity_action: transition.capacityAction,
    },
  })

  return NextResponse.json({ success: true, fromStatus, toStatus })
}