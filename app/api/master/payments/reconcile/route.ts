// app/api/master/payments/reconcile/route.ts
// Purpose: Cross-check local payment records against Chapa's transaction API
// Who can call it: MASTER_ADMIN only

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { isMfaVerifiedInSession } from "@/lib/supabase/session"
import { verifyChapaTransaction } from "@/lib/chapa/server"

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
  const verifyWithChapa = searchParams.get("verifyWithChapa") === "true"

  if (!academicYearId) {
    return NextResponse.json(
      { error: "academicYearId is required" },
      { status: 400 }
    )
  }

  // Fetch all payments for this academic year
  const { data: payments, error } = await adminClient
    .from("payments")
    .select(`
      id, tx_ref, amount, currency, status, source,
      chapa_reference, confirmed_at, created_at,
      override_by, override_reason,
      enrollments!inner (
        id, branch_id, status,
        students!inner (stu_id, full_name),
        branches!inner (name)
      )
    `)
    .eq("enrollments.academic_year_id", academicYearId)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json(
      { error: "Could not fetch payments" },
      { status: 500 }
    )
  }

  const summary = {
    totalPayments: 0,
    totalConfirmed: 0,
    totalPending: 0,
    totalFailed: 0,
    totalExpired: 0,
    totalAmount: 0,
    chapaPayments: 0,
    manualPayments: 0,
    discrepancies: 0,
  }

  const paymentRows = await Promise.all(
    (payments ?? []).map(async (p) => {
      const enrollment = Array.isArray(p.enrollments)
        ? p.enrollments[0]
        : p.enrollments
      const student = Array.isArray(enrollment?.students)
        ? enrollment.students[0]
        : enrollment?.students
      const branch = Array.isArray(enrollment?.branches)
        ? enrollment.branches[0]
        : enrollment?.branches

      summary.totalPayments++
      if (p.status === "CONFIRMED") {
        summary.totalConfirmed++
        summary.totalAmount += parseFloat(p.amount as unknown as string)
      } else if (p.status === "PENDING") {
        summary.totalPending++
      } else if (p.status === "FAILED") {
        summary.totalFailed++
      } else if (p.status === "EXPIRED") {
        summary.totalExpired++
      }

      if (p.source === "CHAPA") summary.chapaPayments++
      if (p.source === "MANUAL_ADMIN_OVERRIDE") summary.manualPayments++

      let chapaStatus: string | null = null
      let discrepancy: string | null = null

      if (
        verifyWithChapa &&
        p.source === "CHAPA" &&
        p.status === "CONFIRMED"
      ) {
        const verification = await verifyChapaTransaction(p.tx_ref)
        chapaStatus = verification.status
        if (verification.status !== "success") {
          discrepancy = `Local status CONFIRMED but Chapa reports: ${verification.status ?? "unknown"}`
          summary.discrepancies++
        } else if (
          verification.amount !== null &&
          Math.abs(
            verification.amount -
              parseFloat(p.amount as unknown as string)
          ) > 0.01
        ) {
          discrepancy = `Amount mismatch — local: ${p.amount}, Chapa: ${verification.amount}`
          summary.discrepancies++
        }
      }

      return {
        id: p.id,
        txRef: p.tx_ref,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        source: p.source,
        chapaReference: p.chapa_reference,
        confirmedAt: p.confirmed_at,
        createdAt: p.created_at,
        overrideReason: p.override_reason,
        enrollmentId: enrollment?.id,
        enrollmentStatus: enrollment?.status,
        studentStuId: student?.stu_id,
        studentFullName: student?.full_name,
        branchName: branch?.name,
        chapaStatus,
        discrepancy,
      }
    })
  )

  return NextResponse.json({
    academicYearId,
    summary,
    payments: paymentRows,
  })
}