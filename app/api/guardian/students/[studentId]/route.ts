// app/api/guardian/students/[studentId]/route.ts
// Purpose: Return everything the Student Profile page needs as JSON.
// Mirrors the direct Supabase queries in
// app/dashboard/guardian/students/[id]/page.tsx exactly, so web and
// mobile both see identical data.
// Who can call it: any guardian (PRIMARY or CO_GUARDIAN) linked to
// this student.

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const paramsSchema = z.object({ studentId: z.string().uuid() })

export async function GET(
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

  // Verify guardian is linked to this student (either role)
  const { data: link } = await adminClient
    .from("guardian_student_links")
    .select("id, link_type")
    .eq("guardian_id", user.id)
    .eq("student_id", studentId)
    .eq("is_active", true)
    .single()

  if (!link) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Fetch student details
  const { data: student } = await adminClient
    .from("students")
    .select("id, stu_id, full_name, date_of_birth, gender, status")
    .eq("id", studentId)
    .single()

  if (!student) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Fetch active co-guardian if exists
  const { data: activeCoGuardianLink } = await adminClient
    .from("guardian_student_links")
    .select(`
      id,
      users!guardian_id (full_name, email)
    `)
    .eq("student_id", studentId)
    .eq("link_type", "CO_GUARDIAN")
    .eq("is_active", true)
    .single()

  // Fetch pending invite sent by this guardian, if any
  const { data: pendingInvite } = await adminClient
    .from("co_guardian_invites")
    .select("id, invited_phone, invite_token_expires_at, status")
    .eq("student_id", studentId)
    .eq("invited_by_guardian_id", user.id)
    .eq("status", "PENDING")
    .single()

  const isPrimary = link.link_type === "PRIMARY"

  const coGuardianUser = activeCoGuardianLink
    ? Array.isArray(activeCoGuardianLink.users)
      ? activeCoGuardianLink.users[0] ?? null
      : activeCoGuardianLink.users
    : null

  return NextResponse.json({
    student: {
      id: student.id,
      stuId: student.stu_id,
      fullName: student.full_name,
      dateOfBirth: student.date_of_birth,
      gender: student.gender,
      status: student.status,
    },
    isPrimary,
    activeCoGuardian: activeCoGuardianLink
      ? {
          id: activeCoGuardianLink.id,
          fullName: coGuardianUser?.full_name ?? null,
          email: coGuardianUser?.email ?? null,
        }
      : null,
    pendingInvite: pendingInvite
      ? {
          id: pendingInvite.id,
          invitedPhone: pendingInvite.invited_phone,
          expiresAt: pendingInvite.invite_token_expires_at,
        }
      : null,
  })
}
