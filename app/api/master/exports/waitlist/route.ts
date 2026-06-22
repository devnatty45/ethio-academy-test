// app/api/master/exports/waitlist/route.ts
// Purpose: Export current waitlist state as CSV
// Who can call it: MASTER_ADMIN only

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { isMfaVerifiedInSession } from "@/lib/supabase/session"
import { writeAuditLog } from "@/lib/utils/audit"

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return ""
  const str =
    typeof value === "object"
      ? JSON.stringify(value)
      : String(value)
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

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

  const mfaVerified = await isMfaVerifiedInSession(user.id)
  if (!mfaVerified) {
    return NextResponse.json(
      { error: "MFA verification required" },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(request.url)
  const academicYearId = searchParams.get("academicYearId")

  if (!academicYearId) {
    return NextResponse.json(
      { error: "academicYearId is required" },
      { status: 400 }
    )
  }

  const { data: waitlisted, error } = await adminClient
    .from("enrollments")
    .select(`
      id, status, waitlisted_at, waitlist_notify_deadline_at,
      students!inner (stu_id, full_name),
      branches!inner (name),
      grades!inner (name),
      streams (name)
    `)
    .eq("academic_year_id", academicYearId)
    .in("status", ["WAITLISTED", "WAITLIST_NOTIFIED", "WAITLIST_EXPIRED"])
    .order("waitlisted_at", { ascending: true })

  if (error) {
    return NextResponse.json(
      { error: "Could not fetch data" },
      { status: 500 }
    )
  }

  const headers = [
    "STU ID",
    "Full Name",
    "Branch",
    "Grade",
    "Stream",
    "Waitlist Status",
    "Waitlisted At",
    "Notify Deadline",
    "Enrollment ID",
  ]

  const rows = (waitlisted ?? []).map((e) => {
    const student = Array.isArray(e.students)
      ? e.students[0]
      : e.students
    const branch = Array.isArray(e.branches) ? e.branches[0] : e.branches
    const grade = Array.isArray(e.grades) ? e.grades[0] : e.grades
    const stream = Array.isArray(e.streams) ? e.streams[0] : e.streams

    return [
      student?.stu_id,
      student?.full_name,
      branch?.name,
      grade?.name,
      stream?.name ?? "",
      e.status,
      e.waitlisted_at ?? "",
      e.waitlist_notify_deadline_at ?? "",
      e.id,
    ].map(escapeCSV)
  })

  const csv = [
    headers.join(","),
    ...rows.map((r) => r.join(",")),
  ].join("\n")

  await writeAuditLog({
    actorId: user.id,
    actorRole: "MASTER_ADMIN",
    actionType: "EXPORT_WAITLIST",
    targetTable: "enrollments",
    targetId: undefined,
    newValue: { academicYearId, rowCount: rows.length },
  })

  const filename = `waitlist-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}