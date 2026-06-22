// app/api/master/seat-capacities/route.ts
// Purpose: Get and set seat capacities per grade/branch/stream/year
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

  // Fetch all active branch-grade configs for this year
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

  // Fetch stream configs for this year (Chereta Grade 11/12)
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

  // Fetch existing capacities for this year
  const { data: capacities } = await adminClient
    .from("grade_capacities")
    .select("*")
    .eq("academic_year_id", academicYearId)

  return NextResponse.json({
    configs: configs ?? [],
    streamConfigs: streamConfigs ?? [],
    capacities: capacities ?? [],
  })
}

// POST — upsert a capacity record
const upsertCapacitySchema = z.object({
  academicYearId: z.string().uuid(),
  branchId: z.string().uuid(),
  gradeId: z.string().uuid(),
  streamId: z.string().uuid().nullable(),
  totalSeats: z.number().int().min(1).max(10000),
  waitlistCapacity: z.number().int().min(0).max(1000),
  waitlistWindowHours: z.number().int().min(1).max(168), // max 7 days
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

  const parsed = upsertCapacitySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const {
    academicYearId,
    branchId,
    gradeId,
    streamId,
    totalSeats,
    waitlistCapacity,
    waitlistWindowHours,
  } = parsed.data

  const adminClient = createAdminClient()

  // Verify academic year is not archived
  const { data: academicYear } = await adminClient
    .from("academic_years")
    .select("id, status")
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

  // If year is OPEN — cannot decrease below current usage
  if (academicYear.status === "OPEN") {
    const { data: existing } = await adminClient
      .from("grade_capacities")
      .select(
        "pending_seats, reserved_seats, enrolled_seats, total_seats"
      )
      .eq("academic_year_id", academicYearId)
      .eq("branch_id", branchId)
      .eq("grade_id", gradeId)
      .eq("stream_id", streamId ?? null)
      .single()

    if (existing) {
      const currentUsage =
        existing.pending_seats +
        existing.reserved_seats +
        existing.enrolled_seats

      if (totalSeats < currentUsage) {
        return NextResponse.json(
          {
            error: `Cannot set total seats to ${totalSeats} — current usage is ${currentUsage} (${existing.pending_seats} pending + ${existing.reserved_seats} reserved + ${existing.enrolled_seats} enrolled).`,
          },
          { status: 409 }
        )
      }
    }
  }

  // Fetch old value for audit log
  const { data: oldCapacity } = await adminClient
    .from("grade_capacities")
    .select("total_seats, waitlist_capacity, waitlist_window_hours")
    .eq("academic_year_id", academicYearId)
    .eq("branch_id", branchId)
    .eq("grade_id", gradeId)
    .eq("stream_id", streamId ?? null)
    .single()

  // Upsert capacity
  const { error: upsertError } = await adminClient
    .from("grade_capacities")
    .upsert(
      {
        academic_year_id: academicYearId,
        branch_id: branchId,
        grade_id: gradeId,
        stream_id: streamId,
        total_seats: totalSeats,
        waitlist_capacity: waitlistCapacity,
        waitlist_window_hours: waitlistWindowHours,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict:
          "academic_year_id,branch_id,grade_id,stream_id",
      }
    )

  if (upsertError) {
    return NextResponse.json(
      { error: "Could not save capacity" },
      { status: 500 }
    )
  }

  await writeAuditLog({
    actorId: masterAdmin.id,
    actorRole: "MASTER_ADMIN",
    actionType: "SEAT_CAPACITY_UPDATED",
    targetTable: "grade_capacities",
    oldValue: oldCapacity
      ? {
          total_seats: oldCapacity.total_seats,
          waitlist_capacity: oldCapacity.waitlist_capacity,
          waitlist_window_hours: oldCapacity.waitlist_window_hours,
        }
      : undefined,
    newValue: {
      academic_year_id: academicYearId,
      branch_id: branchId,
      grade_id: gradeId,
      stream_id: streamId,
      total_seats: totalSeats,
      waitlist_capacity: waitlistCapacity,
      waitlist_window_hours: waitlistWindowHours,
    },
  })

  return NextResponse.json({ success: true })
}