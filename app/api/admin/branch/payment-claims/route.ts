// app/api/admin/branch/payment-claims/route.ts
// Purpose: List PENDING manual payment claims for the admin's branch
// Who can call it: BRANCH_ADMIN for own branch, MASTER_ADMIN for any

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

  if (
    !userData ||
    !["BRANCH_ADMIN", "MASTER_ADMIN"].includes(userData.role)
  ) {
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
  let branchId = searchParams.get("branchId")

  if (userData.role === "BRANCH_ADMIN") {
    const { data: adminProfile } = await adminClient
      .from("admin_profiles")
      .select("assigned_branch_id")
      .eq("user_id", user.id)
      .single()
    branchId = adminProfile?.assigned_branch_id ?? null
  }

  if (!branchId) {
    return NextResponse.json(
      { error: "No branch specified" },
      { status: 400 }
    )
  }

  const { data: claims } = await adminClient
    .from("manual_payment_claims")
    .select(`
      id, amount_paid, payment_date, payment_method,
      reference_number, proof_document_public_id, notes,
      status, created_at,
      enrollments!inner (
        id, fee_structure_id,
        students!inner (stu_id, full_name),
        fee_structures (total_amount)
      )
    `)
    .eq("branch_id", branchId)
    .eq("status", "PENDING")
    .order("created_at", { ascending: true })

  return NextResponse.json({
    claims: (claims ?? []).map((c) => {
      const enrollment = Array.isArray(c.enrollments)
        ? c.enrollments[0]
        : c.enrollments
      const student = Array.isArray(enrollment?.students)
        ? enrollment.students[0]
        : enrollment?.students
      const feeStructure = Array.isArray(enrollment?.fee_structures)
        ? enrollment.fee_structures[0]
        : enrollment?.fee_structures

      return {
        id: c.id,
        amountPaid: c.amount_paid,
        paymentDate: c.payment_date,
        paymentMethod: c.payment_method,
        referenceNumber: c.reference_number,
        proofDocumentPublicId: c.proof_document_public_id,
        notes: c.notes,
        createdAt: c.created_at,
        enrollmentId: enrollment?.id,
        student,
        expectedAmount: feeStructure?.total_amount ?? null,
      }
    }),
  })
}