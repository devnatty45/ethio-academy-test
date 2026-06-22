// app/api/master/payments/summary/route.ts
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { isMfaVerifiedInSession } from "@/lib/supabase/session"

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

  const { data: branches } = await adminClient
    .from("branches")
    .select("id, name")
    .eq("is_active", true)
    .order("name")

  const branchSummaries = await Promise.all(
    (branches ?? []).map(async (branch) => {
      const { data: confirmed } = await adminClient
        .from("payments")
        .select("amount, source, enrollments!inner(branch_id, academic_year_id)")
        .eq("status", "CONFIRMED")
        .eq("enrollments.branch_id", branch.id)
        .eq("enrollments.academic_year_id", academicYearId)

      const totalConfirmed = (confirmed ?? []).length
      const totalAmount = (confirmed ?? []).reduce(
        (sum, p) => sum + parseFloat(p.amount as unknown as string),
        0
      )
      const chapaAmount = (confirmed ?? [])
        .filter((p) => p.source === "CHAPA")
        .reduce(
          (sum, p) => sum + parseFloat(p.amount as unknown as string),
          0
        )
      const manualAmount = (confirmed ?? [])
        .filter((p) => p.source === "MANUAL_ADMIN_OVERRIDE")
        .reduce(
          (sum, p) => sum + parseFloat(p.amount as unknown as string),
          0
        )

      const { data: pending } = await adminClient
        .from("payments")
        .select("id, enrollments!inner(branch_id, academic_year_id)")
        .eq("status", "PENDING")
        .eq("enrollments.branch_id", branch.id)
        .eq("enrollments.academic_year_id", academicYearId)

      return {
        branchId: branch.id,
        branchName: branch.name,
        totalConfirmed,
        totalAmount,
        chapaAmount,
        manualAmount,
        pendingCount: (pending ?? []).length,
      }
    })
  )

  return NextResponse.json({ branchSummaries })
}