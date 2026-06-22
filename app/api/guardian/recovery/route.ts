// app/api/guardian/recovery/route.ts
// Purpose: Submit a Gmail account recovery request
// Who can call it: authenticated guardians with NO linked students
// Rate limited: 3 per hour per IP (applied in proxy.ts already)

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { normalizeEthiopianPhone } from "@/lib/utils/phone"
import { ethiopianPhoneSchema } from "@/lib/validations/common"
import { encryptFanFin } from "@/lib/utils/encryption"
import { verifyFanFin } from "@/lib/utils/encryption"
import { queueSms } from "@/lib/utils/sms"
import { writeAuditLog } from "@/lib/utils/audit"

const recoverySchema = z.object({
  claimedFullName: z.string().min(2).max(100).trim(),
  claimedPhone: ethiopianPhoneSchema,
  claimedFanFin: z
    .string()
    .min(10)
    .max(20)
    .regex(/^\d+$/, "FAN/FIN must be digits only"),
  nationalIdFrontPublicId: z.string().min(1).max(500),
  nationalIdBackPublicId: z.string().min(1).max(500),
  claimedStudentName: z.string().min(2).max(100).trim(),
  claimedStudentDob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/),
  recoveryReason: z.string().min(10).max(1000).trim(),
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
    .select("role, status")
    .eq("id", user.id)
    .single()

  if (!userData || userData.role !== "GUARDIAN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Check abuse: 3 failed attempts in 7 days blocks further attempts
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString()

  const { count: recentAttempts } = await adminClient
    .from("guardian_recovery_requests")
    .select("id", { count: "exact", head: true })
    .eq("new_guardian_id", user.id)
    .gte("created_at", sevenDaysAgo)

  if ((recentAttempts ?? 0) >= 3) {
    await writeAuditLog({
      actorId: user.id,
      actorRole: "GUARDIAN",
      actionType: "RECOVERY_BLOCKED_TOO_MANY_ATTEMPTS",
      newValue: { attempts: recentAttempts },
    })
    return NextResponse.json(
      {
        error:
          "Too many recovery attempts. Please visit the school in person or try again later.",
      },
      { status: 429 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const result = recoverySchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const {
    claimedFullName,
    claimedPhone,
    claimedFanFin,
    nationalIdFrontPublicId,
    nationalIdBackPublicId,
    claimedStudentName,
    claimedStudentDob,
    recoveryReason,
  } = result.data

  const normalizedPhone = normalizeEthiopianPhone(claimedPhone)
  if (!normalizedPhone) {
    return NextResponse.json(
      { error: "Invalid phone number" },
      { status: 400 }
    )
  }

  // Encrypt the submitted FAN/FIN for storage
  let claimedFanFinEncrypted: string
  try {
    claimedFanFinEncrypted = await encryptFanFin(claimedFanFin)
  } catch {
    return NextResponse.json(
      { error: "Could not process request" },
      { status: 500 }
    )
  }

  // Run confidence scoring against all guardian profiles
  let matchedGuardianId: string | null = null
  let verifiedOriginalPhone: string | null = null
  let confidenceLevel: "HIGH" | "MEDIUM" | "LOW" = "LOW"

  // Search by phone number match
  const { data: phoneMatches } = await adminClient
    .from("guardian_profiles")
    .select("user_id, phone, fan_fin_encrypted")
    .eq("phone", normalizedPhone)
    .eq("is_complete", true)

  let phoneMatch = false
  let fanFinMatch = false
  let studentMatch = false

  if (phoneMatches && phoneMatches.length > 0) {
    const candidate = phoneMatches[0]!
    phoneMatch = true
    matchedGuardianId = candidate.user_id
    verifiedOriginalPhone = candidate.phone // Maintain reference to secure original profile phone

    // Verify FAN/FIN
    fanFinMatch = await verifyFanFin(
      claimedFanFin,
      candidate.fan_fin_encrypted
    )
  }

  // Check student name + DOB match for the matched guardian
  if (matchedGuardianId) {
    const { data: studentLinks } = await adminClient
      .from("guardian_student_links")
      .select(`
        students!inner (full_name_normalized, dob_normalized)
      `)
      .eq("guardian_id", matchedGuardianId)
      .eq("is_active", true)

    const claimedNameNorm = claimedStudentName
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ")
    const claimedDobNorm = claimedStudentDob

    for (const link of studentLinks ?? []) {
      const student = Array.isArray(link.students)
        ? link.students[0]
        : link.students
      if (
        student?.full_name_normalized === claimedNameNorm &&
        student?.dob_normalized === claimedDobNorm
      ) {
        studentMatch = true
        break
      }
    }
  }

  // Determine confidence level
  const matchCount = [phoneMatch, fanFinMatch, studentMatch].filter(
    Boolean
  ).length

  if (matchCount === 3) {
    confidenceLevel = "HIGH"
  } else if (matchCount === 2) {
    confidenceLevel = "MEDIUM"
  } else {
    confidenceLevel = "LOW"
  }

  // LOW with no phone match — no guardian found
  if (!matchedGuardianId) {
    confidenceLevel = "LOW"
  }

  // Check if original account was recently active (within 30 days)
  let recentActivityWarning = false
  if (matchedGuardianId) {
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    ).toISOString()

    const { data: recentAuth } = await adminClient
      .from("audit_logs")
      .select("id")
      .eq("actor_id", matchedGuardianId)
      .gte("created_at", thirtyDaysAgo)
      .limit(1)
      .single()

    recentActivityWarning = !!recentAuth
  }

  // Create recovery request
  const { data: newRequest, error: insertError } = await adminClient
    .from("guardian_recovery_requests")
    .insert({
      new_guardian_id: user.id,
      claimed_full_name: claimedFullName,
      claimed_phone: normalizedPhone,
      claimed_fan_fin_encrypted: claimedFanFinEncrypted,
      national_id_front_public_id: nationalIdFrontPublicId,
      national_id_back_public_id: nationalIdBackPublicId,
      claimed_student_name: claimedStudentName,
      claimed_student_dob: claimedStudentDob,
      recovery_reason: recoveryReason,
      confidence_level: confidenceLevel,
      matched_guardian_id: matchedGuardianId,
      status: "PENDING",
    })
    .select("id")
    .single()

  if (insertError || !newRequest) {
    return NextResponse.json(
      { error: "Could not submit recovery request" },
      { status: 500 }
    )
  }

  // Alert the original (matched) guardian's verified phone about the breach attempt
  if (matchedGuardianId && verifiedOriginalPhone) {
    try {
      await queueSms({
        recipientPhone: verifiedOriginalPhone,
        messageBody:
          "Someone has submitted an account recovery request for your Ethio Academy account. If this was not you, please contact the school immediately.",
        triggerEvent: "RECOVERY_ATTEMPT_ALERT",
        relatedId: newRequest.id,
      })
    } catch (smsErr) {
      console.error("[Recovery] Failed to queue critical security warning SMS:", smsErr)
    }
  }

  await writeAuditLog({
    actorId: user.id,
    actorRole: "GUARDIAN",
    actionType: "RECOVERY_REQUEST_SUBMITTED",
    targetTable: "guardian_recovery_requests",
    targetId: newRequest.id,
    newValue: {
      confidence_level: confidenceLevel,
      matched_guardian_id: matchedGuardianId,
      recent_activity_warning: recentActivityWarning,
      phone_match: phoneMatch,
      fan_fin_match: fanFinMatch,
      student_match: studentMatch,
    },
  })

  const messages: Record<string, string> = {
    HIGH:
      "Your recovery request has been submitted and will be reviewed by an administrator.",
    MEDIUM:
      "Your recovery request has been submitted. Additional verification may be required.",
    LOW:
      "Your recovery request has been submitted. Due to low match confidence, you may be required to visit the school in person.",
  }

  return NextResponse.json({
    success: true,
    confidenceLevel,
    message: messages[confidenceLevel],
  })
}

export async function GET(request: NextRequest) {
  // Verify authenticated session
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.json({ message: "Not implemented" }, { status: 501 })
}