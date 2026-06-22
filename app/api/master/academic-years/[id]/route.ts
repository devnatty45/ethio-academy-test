// app/api/master/academic-years/[id]/route.ts
// Purpose: Get a specific academic year and transition its status
// Who can call it: MASTER_ADMIN only

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSensitiveActionVerified } from "@/lib/utils/sensitive-action"
import { writeAuditLog } from "@/lib/utils/audit"
import type { AcademicYearStatus } from "@/types/database"

const paramsSchema = z.object({ id: z.string().uuid() })

const transitionSchema = z.object({
  targetStatus: z.enum(["OPEN", "CLOSED", "ARCHIVED"]),
  reason: z.string().min(10).max(500),
})

// Valid state transitions
const VALID_TRANSITIONS: Record<AcademicYearStatus, AcademicYearStatus[]> = {
  CONFIGURATION: ["OPEN"],
  OPEN: ["CLOSED"],
  CLOSED: ["ARCHIVED"],
  ARCHIVED: [],
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const resolvedParams = await params
  const paramsResult = paramsSchema.safeParse(resolvedParams)
  if (!paramsResult.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { data: year } = await adminClient
    .from("academic_years")
    .select("*")
    .eq("id", paramsResult.data.id)
    .single()

  if (!year) {
    return NextResponse.json(
      { error: "Academic year not found" },
      { status: 404 }
    )
  }

  // Get readiness checks for CONFIGURATION → OPEN transition
  const readiness = await checkOpenReadiness(
    paramsResult.data.id,
    adminClient
  )

  return NextResponse.json({ year, readiness })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireSensitiveActionVerified()
  if (result instanceof NextResponse) return result
  const masterAdmin = result

  const resolvedParams = await params
  const paramsResult = paramsSchema.safeParse(resolvedParams)
  if (!paramsResult.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const yearId = paramsResult.data.id

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const parsed = transitionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { targetStatus, reason } = parsed.data
  const adminClient = createAdminClient()

  const { data: year } = await adminClient
    .from("academic_years")
    .select("id, name, status")
    .eq("id", yearId)
    .single()

  if (!year) {
    return NextResponse.json(
      { error: "Academic year not found" },
      { status: 404 }
    )
  }

  // Validate transition
  const validNext = VALID_TRANSITIONS[year.status as AcademicYearStatus]
  if (!validNext.includes(targetStatus)) {
    return NextResponse.json(
      {
        error: `Cannot transition from ${year.status} to ${targetStatus}`,
      },
      { status: 409 }
    )
  }

  // OPEN transition requires readiness checks
  if (targetStatus === "OPEN") {
    // Only one year can be OPEN at a time
    const { data: openYear } = await adminClient
      .from("academic_years")
      .select("id, name")
      .eq("status", "OPEN")
      .single()

    if (openYear) {
      return NextResponse.json(
        {
          error: `Academic year "${openYear.name}" is already open. Close it before opening a new one.`,
        },
        { status: 409 }
      )
    }

    // Check readiness
    const readiness = await checkOpenReadiness(yearId, adminClient)
    const failedChecks = readiness.filter((c) => !c.passed)

    if (failedChecks.length > 0) {
      return NextResponse.json(
        {
          error: "Academic year is not ready to open.",
          failedChecks: failedChecks.map((c) => c.message),
        },
        { status: 409 }
      )
    }
  }

  // Execute transition
  const { error: updateError } = await adminClient
    .from("academic_years")
    .update({
      status: targetStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", yearId)

  if (updateError) {
    return NextResponse.json(
      { error: "Could not update academic year" },
      { status: 500 }
    )
  }

  await writeAuditLog({
    actorId: masterAdmin.id,
    actorRole: "MASTER_ADMIN",
    actionType: `ACADEMIC_YEAR_${targetStatus}`,
    targetTable: "academic_years",
    targetId: yearId,
    oldValue: { status: year.status },
    newValue: { status: targetStatus, reason },
  })

  return NextResponse.json({ success: true })
}

// Check if an academic year is ready to be opened
async function checkOpenReadiness(
  yearId: string,
  adminClient: ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>
): Promise<{ check: string; passed: boolean; message: string }[]> {
  const checks: { check: string; passed: boolean; message: string }[] = []

  // Check 1: At least one branch-grade config exists
  const { count: configCount } = await adminClient
    .from("branch_grade_configs")
    .select("id", { count: "exact", head: true })
    .eq("academic_year_id", yearId)
    .eq("is_active", true)

  checks.push({
    check: "branch_grade_configs",
    passed: (configCount ?? 0) > 0,
    message:
      (configCount ?? 0) > 0
        ? `${configCount} branch-grade combinations configured`
        : "No branch-grade configurations set. Configure grades per branch first.",
  })

  // Check 2: At least one seat capacity configured
  const { count: capacityCount } = await adminClient
    .from("grade_capacities")
    .select("id", { count: "exact", head: true })
    .eq("academic_year_id", yearId)

  checks.push({
    check: "grade_capacities",
    passed: (capacityCount ?? 0) > 0,
    message:
      (capacityCount ?? 0) > 0
        ? `${capacityCount} grade capacities configured`
        : "No seat capacities set. Configure capacities in Step 24.",
  })

  // Check 3: At least one fee structure configured
  const { count: feeCount } = await adminClient
    .from("fee_structures")
    .select("id", { count: "exact", head: true })
    .eq("academic_year_id", yearId)

  checks.push({
    check: "fee_structures",
    passed: (feeCount ?? 0) > 0,
    message:
      (feeCount ?? 0) > 0
        ? `${feeCount} fee structures configured`
        : "No fee structures set. Configure fees in Step 25.",
  })

  // Check 4: At least one document requirement rule exists (global check)
  const { count: docRuleCount } = await adminClient
    .from("document_requirement_rules")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)

  checks.push({
    check: "document_requirement_rules",
    passed: (docRuleCount ?? 0) > 0,
    message:
      (docRuleCount ?? 0) > 0
        ? `${docRuleCount} document requirement rules configured`
        : "No document requirement rules set. Configure in Step 26.",
  })

  return checks
}