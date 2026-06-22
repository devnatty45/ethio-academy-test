// app/api/master/fee-structures/route.ts
// Purpose: List and create fee structures per year/branch/grade/stream
// Who can call it: MASTER_ADMIN only

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSensitiveActionVerified } from "@/lib/utils/sensitive-action"
import { writeAuditLog } from "@/lib/utils/audit"

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

  const { searchParams } = new URL(request.url)
  const academicYearId = searchParams.get("academicYearId")

  if (!academicYearId) {
    return NextResponse.json(
      { error: "academicYearId is required" },
      { status: 400 }
    )
  }

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(academicYearId)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  // Fetch branch-grade configs for this year
  const { data: configs } = await adminClient
    .from("branch_grade_configs")
    .select(`
      id,
      branch_id,
      grade_id,
      branches!inner (id, name, code),
      grades!inner (id, name, level_order)
    `)
    .eq("academic_year_id", academicYearId)
    .eq("is_active", true)
    .order("branches(name)")

  // Fetch stream configs
  const { data: streamConfigs } = await adminClient
    .from("branch_grade_stream_configs")
    .select(`
      id,
      branch_id,
      grade_id,
      stream_id,
      streams!inner (id, name)
    `)
    .eq("academic_year_id", academicYearId)
    .eq("is_active", true)

  // Fetch existing fee structures for this year
  const { data: feeStructures } = await adminClient
    .from("fee_structures")
    .select("*")
    .eq("academic_year_id", academicYearId)
    .order("created_at", { ascending: false })

  return NextResponse.json({
    configs: configs ?? [],
    streamConfigs: streamConfigs ?? [],
    feeStructures: feeStructures ?? [],
  })
}

// POST — create a new fee structure
const createFeeSchema = z.object({
  academicYearId: z.string().uuid(),
  branchId: z.string().uuid(),
  gradeId: z.string().uuid(),
  streamId: z.string().uuid().nullable(),
  registrationFee: z.number().min(0).max(1000000),
  firstMonthFee: z.number().min(0).max(1000000),
  totalAmount: z.number().min(1).max(10000000),
  effectiveFrom: z.string().datetime(),
})

export async function POST(request: NextRequest) {
  const result = await requireSensitiveActionVerified()
  if (result instanceof NextResponse) return result
  const masterAdmin = result

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const parsed = createFeeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const {
    academicYearId,
    branchId,
    gradeId,
    streamId,
    registrationFee,
    firstMonthFee,
    totalAmount,
    effectiveFrom,
  } = parsed.data

  const adminClient = createAdminClient()

  // Verify academic year not archived
  const { data: academicYear } = await adminClient
    .from("academic_years")
    .select("id, status, name")
    .eq("id", academicYearId)
    .single()

  if (!academicYear) {
    return NextResponse.json(
      { error: "Academic year not found" },
      { status: 404 }
    )
  }

  if (academicYear.status === "ARCHIVED") {
    return NextResponse.json(
      { error: "Cannot modify archived academic year" },
      { status: 409 }
    )
  }

  // Expire the previous active fee structure for this combination
  // by setting effective_until to now
  const { data: existingFee } = await adminClient
    .from("fee_structures")
    .select("id, total_amount, registration_fee, first_month_fee")
    .eq("academic_year_id", academicYearId)
    .eq("branch_id", branchId)
    .eq("grade_id", gradeId)
    .eq("stream_id", streamId ?? null)
    .is("effective_until", null)
    .single()

  if (existingFee) {
    // Close the existing fee structure
    await adminClient
      .from("fee_structures")
      .update({ effective_until: new Date().toISOString() })
      .eq("id", existingFee.id)

    // Log the price change
    await writeAuditLog({
      actorId: masterAdmin.id,
      actorRole: "MASTER_ADMIN",
      actionType: "FEE_STRUCTURE_CHANGED",
      targetTable: "fee_structures",
      targetId: existingFee.id,
      oldValue: {
        registration_fee: existingFee.registration_fee,
        first_month_fee: existingFee.first_month_fee,
        total_amount: existingFee.total_amount,
      },
      newValue: {
        registration_fee: registrationFee,
        first_month_fee: firstMonthFee,
        total_amount: totalAmount,
      },
    })
  }

  // Create new fee structure
  const { data: newFee, error: insertError } = await adminClient
    .from("fee_structures")
    .insert({
      academic_year_id: academicYearId,
      branch_id: branchId,
      grade_id: gradeId,
      stream_id: streamId,
      registration_fee: registrationFee,
      first_month_fee: firstMonthFee,
      total_amount: totalAmount,
      effective_from: effectiveFrom,
      effective_until: null,
    })
    .select("id")
    .single()

  if (insertError || !newFee) {
    return NextResponse.json(
      { error: "Could not create fee structure" },
      { status: 500 }
    )
  }

  if (!existingFee) {
    await writeAuditLog({
      actorId: masterAdmin.id,
      actorRole: "MASTER_ADMIN",
      actionType: "FEE_STRUCTURE_CREATED",
      targetTable: "fee_structures",
      targetId: newFee.id,
      newValue: {
        academic_year_id: academicYearId,
        branch_id: branchId,
        grade_id: gradeId,
        stream_id: streamId,
        registration_fee: registrationFee,
        first_month_fee: firstMonthFee,
        total_amount: totalAmount,
      },
    })
  }

  return NextResponse.json({ success: true })
}