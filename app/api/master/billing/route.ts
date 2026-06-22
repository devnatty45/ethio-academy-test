// app/api/master/billing/route.ts
// Purpose: Get platform billing counter and per-branch breakdown
// Who can call it: MASTER_ADMIN only

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"

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

  // Fetch all academic years with their billing counters
  const { data: years, error: yearsError } = await adminClient
    .from("academic_years")
    .select(`
      id,
      name,
      status,
      start_year,
      platform_billing_counter (
        total_successful_enrollments,
        last_updated_at
      )
    `)
    .order("start_year", { ascending: false })

  if (yearsError) {
    return NextResponse.json(
      { error: "Could not fetch billing data" },
      { status: 500 }
    )
  }

  // For each year, get per-branch enrollment count
  const { data: branchBreakdown, error: breakdownError } = await adminClient
    .from("enrollments")
    .select(`
      academic_year_id,
      branch_id,
      branches!inner (id, name)
    `)
    .eq("status", "ENROLLED")

  if (breakdownError) {
    return NextResponse.json(
      { error: "Could not fetch breakdown data" },
      { status: 500 }
    )
  }

  // Group breakdown by year and branch
  const breakdownByYear: Record<
    string,
    { branchId: string; branchName: string; count: number }[]
  > = {}

  for (const enrollment of branchBreakdown ?? []) {
    const yearId = enrollment.academic_year_id
    if (!breakdownByYear[yearId]) breakdownByYear[yearId] = []

    const branch = Array.isArray(enrollment.branches)
      ? enrollment.branches[0]
      : enrollment.branches

    const branchName = branch?.name ?? "Unknown"
    const branchId = enrollment.branch_id

    const existing = breakdownByYear[yearId]!.find(
      (b) => b.branchId === branchId
    )
    if (existing) {
      existing.count++
    } else {
      breakdownByYear[yearId]!.push({ branchId, branchName, count: 1 })
    }
  }

  return NextResponse.json({
    years: years ?? [],
    breakdownByYear,
    invoiceRate: 100, // ETB per successful enrollment
  })
}