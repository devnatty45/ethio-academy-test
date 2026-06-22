// app/api/guardian/students/[studentId]/invite-co-guardian/route.ts
// Purpose: Generate and send a co-guardian invitation
// Who can call it: PRIMARY guardian of the student only
// Uses co_guardian_invites table — NOT guardian_student_links

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isGuardianProfileComplete } from "@/lib/utils/guardian"
import { normalizeEthiopianPhone } from "@/lib/utils/phone"
import { ethiopianPhoneSchema } from "@/lib/validations/common"
import { queueSms } from "@/lib/utils/sms"
import { writeAuditLog } from "@/lib/utils/audit"
import crypto from "crypto"

const paramsSchema = z.object({ studentId: z.string().uuid() })
const inviteSchema = z.object({ phone: ethiopianPhoneSchema })

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const adminClient = createAdminClient()
  const { data: userData } = await adminClient
    .from("users")
    .select("role, full_name")
    .eq("id", user.id)
    .single()

  if (!userData || userData.role !== "GUARDIAN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const profileComplete = await isGuardianProfileComplete(user.id)
  if (!profileComplete) {
    return NextResponse.json(
      { error: "Complete your profile first" },
      { status: 403 }
    )
  }

  const resolvedParams = await params
  const paramsResult = paramsSchema.safeParse(resolvedParams)
  if (!paramsResult.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { studentId } = paramsResult.data

  // Verify PRIMARY guardian
  const { data: primaryLink } = await adminClient
    .from("guardian_student_links")
    .select("id")
    .eq("guardian_id", user.id)
    .eq("student_id", studentId)
    .eq("link_type", "PRIMARY")
    .eq("is_active", true)
    .single()

  if (!primaryLink) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const result = inviteSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const normalizedPhone = normalizeEthiopianPhone(result.data.phone)
  if (!normalizedPhone) {
    return NextResponse.json(
      { error: "Invalid phone number" },
      { status: 400 }
    )
  }

  // Check student does not already have active co-guardian
  const { data: activeCoGuardian } = await adminClient
    .from("guardian_student_links")
    .select("id")
    .eq("student_id", studentId)
    .eq("link_type", "CO_GUARDIAN")
    .eq("is_active", true)
    .single()

  if (activeCoGuardian) {
    return NextResponse.json(
      {
        error:
          "This student already has an active co-guardian. Revoke them first.",
      },
      { status: 409 }
    )
  }

  const { data: student } = await adminClient
    .from("students")
    .select("full_name")
    .eq("id", studentId)
    .single()

  if (!student) {
    return NextResponse.json(
      { error: "Student not found" },
      { status: 404 }
    )
  }

  // Expire any existing PENDING invites for this student
  await adminClient
    .from("co_guardian_invites")
    .update({
      status: "REVOKED",
      updated_at: new Date().toISOString(),
    })
    .eq("student_id", studentId)
    .eq("invited_by_guardian_id", user.id)
    .eq("status", "PENDING")

  // Generate token
  const token = crypto.randomBytes(32).toString("hex")
  const expiresAt = new Date(
    Date.now() + 48 * 60 * 60 * 1000
  ).toISOString()

  // Insert into co_guardian_invites — NOT guardian_student_links
  const { error: insertError } = await adminClient
    .from("co_guardian_invites")
    .insert({
      student_id: studentId,
      invited_phone: normalizedPhone,
      invite_token: token,
      invite_token_expires_at: expiresAt,
      invited_by_guardian_id: user.id,
      status: "PENDING",
    })

  if (insertError) {
    return NextResponse.json(
      { error: "Could not create invitation" },
      { status: 500 }
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const inviteUrl = `${appUrl}/invite/co-guardian?token=${token}`

  await queueSms({
    recipientPhone: normalizedPhone,
    messageBody: `You have been invited by ${userData.full_name ?? "a guardian"} to be a co-guardian for ${student.full_name} on the School Registration System. Click to accept: ${inviteUrl} (Link expires in 48 hours)`,
    triggerEvent: "CO_GUARDIAN_INVITE",
    relatedId: studentId,
  })

  await writeAuditLog({
    actorId: user.id,
    actorRole: "GUARDIAN",
    actionType: "CO_GUARDIAN_INVITE_SENT",
    targetTable: "co_guardian_invites",
    targetId: studentId,
    newValue: {
      student_id: studentId,
      invited_phone: normalizedPhone,
      expires_at: expiresAt,
    },
  })

  return NextResponse.json({
    success: true,
    message: "Invitation sent. The co-guardian has 48 hours to accept.",
  })
}