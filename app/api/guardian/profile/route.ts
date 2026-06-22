// app/api/guardian/profile/route.ts
// Purpose: Create or update guardian profile
// Who can call it: authenticated guardians only
// FAN/FIN encrypted before storage — never stored plaintext

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { encryptFanFin } from "@/lib/utils/encryption"
import { normalizeEthiopianPhone } from "@/lib/utils/phone"
import { ethiopianPhoneSchema } from "@/lib/validations/common"
import { writeAuditLog } from "@/lib/utils/audit"
import { queueSms } from "@/lib/utils/sms" // Added import for SMS queuing helper

const profileSchema = z.object({
  fullName: z.string().min(2).max(100).trim(),
  phone: ethiopianPhoneSchema,
  fanFin: z
    .string()
    .min(10)
    .max(20)
    .regex(/^\d+$/, "FAN/FIN must contain only digits"),
  nationalIdFrontPublicId: z.string().min(1).max(500),
  nationalIdBackPublicId: z.string().min(1).max(500),
  residentialAddress: z.string().min(5).max(500).trim(),
})

export async function POST(request: NextRequest) {
  // Verify authenticated session
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Verify role is GUARDIAN
  const adminClient = createAdminClient()
  const { data: userData } = await adminClient
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!userData || userData.role !== "GUARDIAN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Validate request body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const result = profileSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const {
    fullName,
    phone,
    fanFin,
    nationalIdFrontPublicId,
    nationalIdBackPublicId,
    residentialAddress,
  } = result.data

  // Normalize phone to +251 format
  const normalizedPhone = normalizeEthiopianPhone(phone)
  if (!normalizedPhone) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  // Encrypt FAN/FIN — never store plaintext
  let fanFinEncrypted: string
  try {
    fanFinEncrypted = await encryptFanFin(fanFin)
  } catch (err) {
    console.error("[Profile] Encryption error:", err)
    return NextResponse.json(
      { error: "Profile could not be saved" },
      { status: 500 }
    )
  }

  // Replace the upsert block
  const { error: upsertError } = await adminClient
    .from("guardian_profiles")
    .upsert(
      {
        user_id: user.id,
        full_name: fullName,
        phone: normalizedPhone,
        fan_fin_encrypted: fanFinEncrypted,
        national_id_front_public_id: nationalIdFrontPublicId,
        national_id_back_public_id: nationalIdBackPublicId,
        residential_address: residentialAddress,
        is_complete: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )

  if (upsertError) {
    console.error("[Profile] Upsert error:", upsertError)
    return NextResponse.json(
      { error: "Profile could not be saved" },
      { status: 500 }
    )
  }

  // Update full_name in users table to match profile
  await adminClient
    .from("users")
    .update({ full_name: fullName, updated_at: new Date().toISOString() })
    .eq("id", user.id)

  // Queue confirmation SMS to the guardian asynchronously 
  try {
    await queueSms({
      recipientPhone: normalizedPhone,
      messageBody:
        "Welcome to Ethio Academy! Your profile is complete. You can now enroll your child for the upcoming academic year.",
      triggerEvent: "GUARDIAN_PROFILE_COMPLETED",
      relatedId: user.id,
    })
  } catch (smsErr) {
    // We catch the error so a transient queuing hitch doesn't fail the registration transaction for the user
    console.error("[Profile] Failed to queue welcome SMS:", smsErr)
  }

  // Audit log — note: FAN/FIN is never logged
  await writeAuditLog({
    actorId: user.id,
    actorRole: "GUARDIAN",
    actionType: "GUARDIAN_PROFILE_COMPLETED",
    targetTable: "guardian_profiles",
    targetId: user.id,
    newValue: {
      full_name: fullName,
      phone: normalizedPhone,
      has_national_id: true,
    },
  })

  return NextResponse.json({ message: "Profile saved" })
}

export async function GET(request: NextRequest) {
  // Verify authenticated session
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from("guardian_profiles")
    .select(
      `
      id,
      full_name,
      phone,
      national_id_front_public_id,
      national_id_back_public_id,
      residential_address,
      is_complete,
      created_at,
      updated_at
    `
    )
    // fan_fin_encrypted deliberately excluded from SELECT
    .eq("user_id", user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ profile: null })
  }

  return NextResponse.json({ profile })
}