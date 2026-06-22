// app/api/invite/co-guardian/accept/route.ts
// Purpose: Accept a co-guardian invitation via token
// Reads from co_guardian_invites, creates row in guardian_student_links

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { writeAuditLog } from "@/lib/utils/audit"

const acceptSchema = z.object({
  token: z.string().min(64).max(64),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const result = acceptSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { token } = result.data
  const adminClient = createAdminClient()

  // Find invite by token
  const { data: invite } = await adminClient
    .from("co_guardian_invites")
    .select(`
      id,
      student_id,
      invited_by_guardian_id,
      invite_token_expires_at,
      status,
      students!inner (full_name),
      users!invited_by_guardian_id (full_name, email)
    `)
    .eq("invite_token", token)
    .single()

  if (!invite) {
    return NextResponse.json(
      { error: "Invitation not found or already used" },
      { status: 404 }
    )
  }

  if (invite.status !== "PENDING") {
    return NextResponse.json(
      { error: "This invitation has already been used or revoked" },
      { status: 409 }
    )
  }

  if (new Date(invite.invite_token_expires_at) < new Date()) {
    // Mark as expired
    await adminClient
      .from("co_guardian_invites")
      .update({ status: "EXPIRED", updated_at: new Date().toISOString() })
      .eq("id", invite.id)

    return NextResponse.json(
      {
        error:
          "This invitation has expired. Ask the primary guardian to send a new one.",
      },
      { status: 410 }
    )
  }

  if (invite.invited_by_guardian_id === user.id) {
    return NextResponse.json(
      { error: "You cannot accept your own invitation" },
      { status: 409 }
    )
  }

  // Check student does not already have active co-guardian
  const { data: existingCoGuardian } = await adminClient
    .from("guardian_student_links")
    .select("id")
    .eq("student_id", invite.student_id)
    .eq("link_type", "CO_GUARDIAN")
    .eq("is_active", true)
    .single()

  if (existingCoGuardian) {
    return NextResponse.json(
      { error: "This student already has an active co-guardian" },
      { status: 409 }
    )
  }

  // Check acceptor not already linked to this student
  const { data: existingLink } = await adminClient
    .from("guardian_student_links")
    .select("id")
    .eq("guardian_id", user.id)
    .eq("student_id", invite.student_id)
    .eq("is_active", true)
    .single()

  if (existingLink) {
    return NextResponse.json(
      { error: "You are already linked to this student" },
      { status: 409 }
    )
  }

  // Create real guardian_student_links row
  const { error: linkError } = await adminClient
    .from("guardian_student_links")
    .insert({
      guardian_id: user.id,
      student_id: invite.student_id,
      link_type: "CO_GUARDIAN",
      is_active: true,
      invited_by_guardian_id: invite.invited_by_guardian_id,
    })

  if (linkError) {
  console.error("CO-GUARDIAN LINK ERROR:", linkError)

  return NextResponse.json(
    {
      error: linkError.message,
      details: linkError,
    },
    { status: 500 }
  )
}

  // Mark invite as accepted
  await adminClient
    .from("co_guardian_invites")
    .update({
      status: "ACCEPTED",
      accepted_by_guardian_id: user.id,
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", invite.id)

  const student = Array.isArray(invite.students)
    ? invite.students[0]
    : invite.students

  const primaryGuardian = Array.isArray(invite.users)
    ? invite.users[0]
    : invite.users

  await writeAuditLog({
    actorId: user.id,
    actorRole: "GUARDIAN",
    actionType: "CO_GUARDIAN_ACCEPTED",
    targetTable: "guardian_student_links",
    targetId: invite.student_id,
    newValue: {
      co_guardian_id: user.id,
      student_id: invite.student_id,
      primary_guardian_id: invite.invited_by_guardian_id,
    },
  })

  return NextResponse.json({
    success: true,
    studentName: student?.full_name ?? "Unknown",
    primaryGuardianName: primaryGuardian?.full_name ?? "Unknown",
  })
}

// GET — fetch invite details before accepting
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const token = searchParams.get("token")

  if (!token || token.length !== 64) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 })
  }

  const adminClient = createAdminClient()

  const { data: invite } = await adminClient
    .from("co_guardian_invites")
    .select(`
      id,
      invite_token_expires_at,
      status,
      students!inner (full_name, stu_id),
      users!invited_by_guardian_id (full_name)
    `)
    .eq("invite_token", token)
    .single()

  if (!invite) {
    return NextResponse.json(
      { error: "Invitation not found or already used" },
      { status: 404 }
    )
  }

  if (invite.status !== "PENDING") {
    return NextResponse.json(
      { error: "This invitation has already been used or revoked" },
      { status: 409 }
    )
  }

  if (new Date(invite.invite_token_expires_at) < new Date()) {
    return NextResponse.json(
      { error: "This invitation has expired" },
      { status: 410 }
    )
  }

  const student = Array.isArray(invite.students)
    ? invite.students[0]
    : invite.students

  const primaryGuardian = Array.isArray(invite.users)
    ? invite.users[0]
    : invite.users

  return NextResponse.json({
    studentName: student?.full_name ?? "Unknown",
    stuId: student?.stu_id ?? "Unknown",
    primaryGuardianName: primaryGuardian?.full_name ?? "Unknown",
    expiresAt: invite.invite_token_expires_at,
  })
}