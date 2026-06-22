// app/api/guardian/students/[studentId]/co-guardian/route.ts
// Purpose: Revoke an active co-guardian link
// Who can call it: PRIMARY guardian of the student only

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { writeAuditLog } from "@/lib/utils/audit"

const paramsSchema = z.object({ studentId: z.string().uuid() })

export async function DELETE(
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
    .select("role")
    .eq("id", user.id)
    .single()

  if (!userData || userData.role !== "GUARDIAN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
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

  // Revoke active co-guardian link
  const { data: coGuardianLink } = await adminClient
    .from("guardian_student_links")
    .select("id, guardian_id")
    .eq("student_id", studentId)
    .eq("link_type", "CO_GUARDIAN")
    .eq("is_active", true)
    .single()

  if (!coGuardianLink) {
    return NextResponse.json(
      { error: "No active co-guardian found for this student" },
      { status: 404 }
    )
  }

  await adminClient
    .from("guardian_student_links")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", coGuardianLink.id)

  await writeAuditLog({
    actorId: user.id,
    actorRole: "GUARDIAN",
    actionType: "CO_GUARDIAN_REVOKED",
    targetTable: "guardian_student_links",
    targetId: coGuardianLink.id,
    oldValue: { is_active: true },
    newValue: {
      is_active: false,
      revoked_by: user.id,
      student_id: studentId,
    },
  })

  return NextResponse.json({ success: true })
}