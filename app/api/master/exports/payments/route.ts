// app/api/master/exports/payments/route.ts
// Purpose: Export payment records by date range as CSV
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
  const dateFrom = searchParams.get("dateFrom")
  const dateTo = searchParams.get("dateTo")
  const academicYearId = searchParams.get("academicYearId")

  let query = adminClient
    .from("payments")
    .select(`
      id, tx_ref, chapa_reference, amount, currency,
      status, source, override_reason, confirmed_at, created_at,
      enrollments!inner (
        academic_year_id,
        students!inner (stu_id, full_name),
        branches!inner (name),
        grades!inner (name),
        academic_years!inner (name)
      )
    `)
    .order("created_at", { ascending: false })
    .limit(10000)

  if (dateFrom) {
    query = query.gte("created_at", new Date(dateFrom).toISOString())
  }
  if (dateTo) {
    const end = new Date(dateTo)
    end.setHours(23, 59, 59, 999)
    query = query.lte("created_at", end.toISOString())
  }
  if (academicYearId) {
    query = query.eq(
      "enrollments.academic_year_id",
      academicYearId
    )
  }

  const { data: payments, error } = await query

  if (error) {
    return NextResponse.json(
      { error: "Could not fetch data" },
      { status: 500 }
    )
  }

  const headers = [
    "Payment ID",
    "Merchant Ref (tx_ref)",
    "Chapa Reference",
    "Student STU ID",
    "Student Name",
    "Branch",
    "Grade",
    "Academic Year",
    "Amount (ETB)",
    "Currency",
    "Status",
    "Source",
    "Override Reason",
    "Confirmed At",
    "Created At",
  ]

  const rows = (payments ?? []).map((p) => {
    const enrollment = Array.isArray(p.enrollments)
      ? p.enrollments[0]
      : p.enrollments
    const student = Array.isArray(enrollment?.students)
      ? enrollment.students[0]
      : enrollment?.students
    const branch = Array.isArray(enrollment?.branches)
      ? enrollment.branches[0]
      : enrollment?.branches
    const grade = Array.isArray(enrollment?.grades)
      ? enrollment.grades[0]
      : enrollment?.grades
    const year = Array.isArray(enrollment?.academic_years)
      ? enrollment.academic_years[0]
      : enrollment?.academic_years

    return [
      p.id,
      p.tx_ref,
      p.chapa_reference ?? "",
      student?.stu_id ?? "",
      student?.full_name ?? "",
      branch?.name ?? "",
      grade?.name ?? "",
      year?.name ?? "",
      p.amount,
      p.currency,
      p.status,
      p.source,
      p.override_reason ?? "",
      p.confirmed_at ?? "",
      p.created_at,
    ].map(escapeCSV)
  })

  const csv = [
    headers.join(","),
    ...rows.map((r) => r.join(",")),
  ].join("\n")

  await writeAuditLog({
    actorId: user.id,
    actorRole: "MASTER_ADMIN",
    actionType: "EXPORT_PAYMENTS",
    targetTable: "payments",
    targetId: undefined,
    newValue: {
      dateFrom,
      dateTo,
      academicYearId,
      rowCount: rows.length,
    },
  })

  const filename = `payments-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}