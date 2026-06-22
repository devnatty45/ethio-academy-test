// app/api/master/exports/billing-summary/route.ts
// Purpose: Export platform billing summary for invoice generation
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

  const { data: year } = await adminClient
    .from("academic_years")
    .select("name")
    .eq("id", academicYearId)
    .single()

  const { data: billingCounter } = await adminClient
    .from("platform_billing_counter")
    .select("total_successful_enrollments, last_updated_at")
    .eq("academic_year_id", academicYearId)
    .single()

  // Per-branch breakdown
  const { data: branches } = await adminClient
    .from("branches")
    .select("id, name")
    .eq("is_active", true)
    .order("name")

  const branchRows = await Promise.all(
    (branches ?? []).map(async (branch) => {
      const { count: enrolledCount } = await adminClient
        .from("enrollments")
        .select("id", { count: "exact", head: true })
        .eq("academic_year_id", academicYearId)
        .eq("branch_id", branch.id)
        .eq("status", "ENROLLED")

      const { data: confirmedPayments } = await adminClient
        .from("payments")
        .select("amount, source")
        .eq("status", "CONFIRMED")
        .eq("enrollments.academic_year_id", academicYearId)
        .eq("enrollments.branch_id", branch.id)

      const totalRevenue = (confirmedPayments ?? []).reduce(
        (sum, p) =>
          sum + parseFloat(p.amount as unknown as string),
        0
      )
      const chapaRevenue = (confirmedPayments ?? [])
        .filter((p) => p.source === "CHAPA")
        .reduce(
          (sum, p) =>
            sum + parseFloat(p.amount as unknown as string),
          0
        )
      const manualRevenue = (confirmedPayments ?? [])
        .filter((p) => p.source === "MANUAL_ADMIN_OVERRIDE")
        .reduce(
          (sum, p) =>
            sum + parseFloat(p.amount as unknown as string),
          0
        )

      return [
        branch.name,
        enrolledCount ?? 0,
        totalRevenue.toFixed(2),
        chapaRevenue.toFixed(2),
        manualRevenue.toFixed(2),
      ]
    })
  )

  const headers = [
    "Branch",
    "Enrolled Students",
    "Total Revenue (ETB)",
    "Via Chapa (ETB)",
    "Manual Override (ETB)",
  ]

  // Summary rows at top, then per-branch
  const summarySection = [
    ["Academic Year", year?.name ?? academicYearId],
    [
      "Total Enrolled (Platform Counter)",
      billingCounter?.total_successful_enrollments ?? 0,
    ],
    [
      "Counter Last Updated",
      billingCounter?.last_updated_at ?? "",
    ],
    ["Export Generated At", new Date().toISOString()],
    ["", ""],
    headers,
    ...branchRows,
  ].map(escapeCSV)

  // Build as two sections
  const metaSection = [
    `Academic Year,${escapeCSV(year?.name ?? academicYearId)}`,
    `Total Enrolled (Platform Counter),${escapeCSV(billingCounter?.total_successful_enrollments ?? 0)}`,
    `Counter Last Updated,${escapeCSV(billingCounter?.last_updated_at ?? "")}`,
    `Export Generated At,${escapeCSV(new Date().toISOString())}`,
    "",
    headers.join(","),
    ...branchRows.map((r) =>
      r.map(escapeCSV).join(",")
    ),
  ]

  const csv = metaSection.join("\n")

  await writeAuditLog({
    actorId: user.id,
    actorRole: "MASTER_ADMIN",
    actionType: "EXPORT_BILLING_SUMMARY",
    targetTable: "platform_billing_counter",
    targetId: undefined,
    newValue: {
      academicYearId,
      totalEnrolled:
        billingCounter?.total_successful_enrollments ?? 0,
    },
  })

  const filename = `billing-summary-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}