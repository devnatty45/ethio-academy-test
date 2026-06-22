// app/api/master/exports/capacity/route.ts
// Purpose: Export capacity utilization report per branch/grade as CSV
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

  const { data: capacities, error } = await adminClient
    .from("grade_capacities")
    .select(`
      total_seats, pending_seats, reserved_seats,
      enrolled_seats, waitlist_count,
      branches!inner (name),
      grades!inner (name, level_order),
      streams (name)
    `)
    .eq("academic_year_id", academicYearId)

  if (error) {
    console.error("[ExportCapacity] Query error:", error)
    return NextResponse.json(
      { error: "Could not fetch data" },
      { status: 500 }
    )
  }

  // Sort in JavaScript — branch name ascending, then grade level ascending
  const sorted = (capacities ?? []).slice().sort((a, b) => {
    const aBranch = (
      Array.isArray(a.branches) ? a.branches[0] : a.branches
    )?.name ?? ""
    const bBranch = (
      Array.isArray(b.branches) ? b.branches[0] : b.branches
    )?.name ?? ""
    if (aBranch !== bBranch) return aBranch.localeCompare(bBranch)

    const aLevel = (
      Array.isArray(a.grades) ? a.grades[0] : a.grades
    )?.level_order ?? 0
    const bLevel = (
      Array.isArray(b.grades) ? b.grades[0] : b.grades
    )?.level_order ?? 0
    return aLevel - bLevel
  })

  const headers = [
    "Branch",
    "Grade",
    "Stream",
    "Total Seats",
    "Enrolled",
    "Reserved",
    "Pending",
    "Waitlisted",
    "Available",
    "Fill Rate (%)",
  ]

  const rows = sorted.map((c) => {
    const branch = Array.isArray(c.branches)
      ? c.branches[0]
      : c.branches
    const grade = Array.isArray(c.grades) ? c.grades[0] : c.grades
    const stream = Array.isArray(c.streams) ? c.streams[0] : c.streams

    const available =
      c.total_seats -
      c.pending_seats -
      c.reserved_seats -
      c.enrolled_seats

    const fillRate =
      c.total_seats > 0
        ? (
            ((c.enrolled_seats + c.reserved_seats) / c.total_seats) *
            100
          ).toFixed(1)
        : "0.0"

    return [
      branch?.name,
      grade?.name,
      stream?.name ?? "",
      c.total_seats,
      c.enrolled_seats,
      c.reserved_seats,
      c.pending_seats,
      c.waitlist_count,
      Math.max(0, available),
      fillRate,
    ].map(escapeCSV)
  })

  const csv = [
    headers.join(","),
    ...rows.map((r) => r.join(",")),
  ].join("\n")

  await writeAuditLog({
    actorId: user.id,
    actorRole: "MASTER_ADMIN",
    actionType: "EXPORT_CAPACITY",
    targetTable: "grade_capacities",
    targetId: undefined,
    newValue: { academicYearId, rowCount: rows.length },
  })

  const filename = `capacity-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}