// app/api/master/enrollments/extend-deadline/route.ts
// Purpose: Master Admin extends the payment deadline for a
//          PAYMENT_PENDING enrollment
// Rules: new deadline must be in the future, max 7 days from NOW
// Who can call it: MASTER_ADMIN only

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isMfaVerifiedInSession } from "@/lib/supabase/session"
import { writeAuditLog } from "@/lib/utils/audit"

const MAX_EXTENSION_DAYS = 7

const extendSchema = z.object({
  enrollmentId: z.string().uuid(),
  newDeadline: z.string().datetime(),
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

  const parsed = extendSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    )
  }

  const { enrollmentId, newDeadline, reason } = parsed.data

  const newDeadlineDate = new Date(newDeadline)
  const now = new Date()
  const maxAllowed = new Date(
    now.getTime() + MAX_EXTENSION_DAYS * 24 * 60 * 60 * 1000
  )

  if (newDeadlineDate <= now) {
    return NextResponse.json(
      { error: "New deadline must be in the future" },
      { status: 400 }
    )
  }

  if (newDeadlineDate > maxAllowed) {
    return NextResponse.json(
      {
        error: `New deadline cannot be more than ${MAX_EXTENSION_DAYS} days from now`,
      },
      { status: 400 }
    )
  }

  const { data: enrollment } = await adminClient
    .from("enrollments")
    .select(
      "id, status, payment_deadline_at, guardian_id"
    )
    .eq("id", enrollmentId)
    .single()

  if (!enrollment) {
    return NextResponse.json(
      { error: "Enrollment not found" },
      { status: 404 }
    )
  }

  if (enrollment.status !== "PAYMENT_PENDING") {
    return NextResponse.json(
      {
        error: `Cannot extend deadline — enrollment is in ${enrollment.status} status, not PAYMENT_PENDING`,
      },
      { status: 409 }
    )
  }

  const oldDeadline = enrollment.payment_deadline_at

  const { error: updateError } = await adminClient
    .from("enrollments")
    .update({
      payment_deadline_at: newDeadlineDate.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", enrollmentId)

  if (updateError) {
    console.error(
      "[ExtendDeadline] Update error:",
      updateError
    )
    return NextResponse.json(
      { error: "Could not update deadline" },
      { status: 500 }
    )
  }

  await adminClient.from("enrollment_transitions").insert({
    enrollment_id: enrollmentId,
    from_status: "PAYMENT_PENDING",
    to_status: "PAYMENT_PENDING",
    actor_id: user.id,
    actor_role: "MASTER_ADMIN",
    reason: `[DEADLINE EXTENDED] ${reason}`,
    metadata: {
      old_deadline: oldDeadline,
      new_deadline: newDeadlineDate.toISOString(),
    },
  })

  await writeAuditLog({
    actorId: user.id,
    actorRole: "MASTER_ADMIN",
    actionType: "PAYMENT_DEADLINE_EXTENDED",
    targetTable: "enrollments",
    targetId: enrollmentId,
    oldValue: { payment_deadline_at: oldDeadline },
    newValue: {
      payment_deadline_at: newDeadlineDate.toISOString(),
      reason,
    },
  })

  return NextResponse.json({
    success: true,
    oldDeadline,
    newDeadline: newDeadlineDate.toISOString(),
  })
}