// app/api/master/guardians/merge/route.ts
// Purpose: Preview and execute guardian account merges
// Who can call it: MASTER_ADMIN only with sensitive action verified

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSensitiveActionVerified } from "@/lib/utils/sensitive-action"
import { writeAuditLog } from "@/lib/utils/audit"

// GET — preview merge of two guardian accounts
export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url)
  const guardianAId = searchParams.get("guardianA")
  const guardianBId = searchParams.get("guardianB")

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  if (
    !guardianAId ||
    !guardianBId ||
    !uuidRegex.test(guardianAId) ||
    !uuidRegex.test(guardianBId)
  ) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  if (guardianAId === guardianBId) {
    return NextResponse.json(
      { error: "Cannot merge an account with itself" },
      { status: 400 }
    )
  }

  // Fetch both guardians
  const [guardianARes, guardianBRes] = await Promise.all([
    adminClient
      .from("users")
      .select(`
        id, email, full_name, status, created_at,
        guardian_profiles (
          full_name, phone, is_complete, residential_address
        )
      `)
      .eq("id", guardianAId)
      .eq("role", "GUARDIAN")
      .single(),
    adminClient
      .from("users")
      .select(`
        id, email, full_name, status, created_at,
        guardian_profiles (
          full_name, phone, is_complete, residential_address
        )
      `)
      .eq("id", guardianBId)
      .eq("role", "GUARDIAN")
      .single(),
  ])

  if (!guardianARes.data || !guardianBRes.data) {
    return NextResponse.json(
      { error: "One or both guardian accounts not found" },
      { status: 404 }
    )
  }

  // Fetch linked students for each
  const [studentsA, studentsB] = await Promise.all([
    adminClient
      .from("guardian_student_links")
      .select(`
        id, link_type, is_active,
        students!inner (id, stu_id, full_name, date_of_birth)
      `)
      .eq("guardian_id", guardianAId)
      .eq("is_active", true),
    adminClient
      .from("guardian_student_links")
      .select(`
        id, link_type, is_active,
        students!inner (id, stu_id, full_name, date_of_birth)
      `)
      .eq("guardian_id", guardianBId)
      .eq("is_active", true),
  ])

  // Determine suggested surviving account — older created_at
  const suggestedSurvivingId =
    new Date(guardianARes.data.created_at) <=
    new Date(guardianBRes.data.created_at)
      ? guardianAId
      : guardianBId

  return NextResponse.json({
    guardianA: {
      ...guardianARes.data,
      linkedStudents: studentsA.data ?? [],
    },
    guardianB: {
      ...guardianBRes.data,
      linkedStudents: studentsB.data ?? [],
    },
    suggestedSurvivingId,
  })
}

// POST — execute the guardian merge
const mergeSchema = z.object({
  survivingGuardianId: z.string().uuid(),
  sourceGuardianId: z.string().uuid(),
  reason: z.string().min(10).max(500),
})

export async function POST(request: NextRequest) {
  const result = await requireSensitiveActionVerified()
  if (result instanceof NextResponse) return result
  const masterAdmin = result

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const parsed = mergeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { survivingGuardianId, sourceGuardianId, reason } = parsed.data

  if (survivingGuardianId === sourceGuardianId) {
    return NextResponse.json(
      { error: "Cannot merge an account with itself" },
      { status: 400 }
    )
  }

  const adminClient = createAdminClient()

  // Fetch both accounts for audit log
  const [surviving, source] = await Promise.all([
    adminClient
      .from("users")
      .select("id, email, full_name, status")
      .eq("id", survivingGuardianId)
      .single(),
    adminClient
      .from("users")
      .select("id, email, full_name, status")
      .eq("id", sourceGuardianId)
      .single(),
  ])

  if (!surviving.data || !source.data) {
    return NextResponse.json(
      { error: "One or both accounts not found" },
      { status: 404 }
    )
  }

  if (source.data.status === "DEACTIVATED") {
    return NextResponse.json(
      { error: "Source account is already deactivated" },
      { status: 409 }
    )
  }

  // Fetch source account's student links
  const { data: sourceLinks } = await adminClient
    .from("guardian_student_links")
    .select("id, student_id, link_type, is_active")
    .eq("guardian_id", sourceGuardianId)
    .eq("is_active", true)

  // Transfer each link to surviving account
  for (const link of sourceLinks ?? []) {
    // Check if surviving account already has a link to this student
    const { data: existingLink } = await adminClient
      .from("guardian_student_links")
      .select("id")
      .eq("guardian_id", survivingGuardianId)
      .eq("student_id", link.student_id)
      .eq("is_active", true)
      .single()

    if (existingLink) {
      // Duplicate — deactivate source link
      await adminClient
        .from("guardian_student_links")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", link.id)
    } else {
      // Transfer link to surviving account
      await adminClient
        .from("guardian_student_links")
        .update({
          guardian_id: survivingGuardianId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", link.id)
    }
  }

  // Transfer enrollments guardian_id
  await adminClient
    .from("enrollments")
    .update({ guardian_id: survivingGuardianId })
    .eq("guardian_id", sourceGuardianId)

  // Transfer payments guardian_id
  await adminClient
    .from("payments")
    .update({ guardian_id: survivingGuardianId })
    .eq("guardian_id", sourceGuardianId)

  // Transfer manual payment claims
  await adminClient
    .from("manual_payment_claims")
    .update({ guardian_id: survivingGuardianId })
    .eq("guardian_id", sourceGuardianId)

  // Deactivate source account
  await adminClient
    .from("users")
    .update({
      status: "DEACTIVATED",
      recovery_transferred_to: survivingGuardianId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sourceGuardianId)

  await writeAuditLog({
    actorId: masterAdmin.id,
    actorRole: "MASTER_ADMIN",
    actionType: "GUARDIAN_ACCOUNT_MERGED",
    targetTable: "users",
    targetId: survivingGuardianId,
    oldValue: {
      source_email: source.data.email,
      source_id: sourceGuardianId,
    },
    newValue: {
      surviving_email: surviving.data.email,
      surviving_id: survivingGuardianId,
      links_transferred: sourceLinks?.length ?? 0,
      reason,
    },
  })

  return NextResponse.json({ success: true })
}