// app/api/enrollment/availability/route.ts
// Purpose: Get available branches and grades with seat counts
//          for the current open academic year
// Who can call it: authenticated guardians

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { getOpenAcademicYear } from "@/lib/utils/enrollment"

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

  if (!userData || userData.role !== "GUARDIAN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const openYear = await getOpenAcademicYear()
  if (!openYear) {
    return NextResponse.json(
      { error: "Enrollment is not currently open" },
      { status: 409 }
    )
  }

  // Fetch branch-grade configs with capacity data
  const { data: configs } = await adminClient
    .from("branch_grade_configs")
    .select(`
      id,
      branch_id,
      grade_id,
      branches!inner (id, name, code, is_active),
      grades!inner (id, name, level_order)
    `)
    .eq("academic_year_id", openYear.id)
    .eq("is_active", true)

  // Fetch capacity data for this year
  const { data: capacities } = await adminClient
    .from("grade_capacities")
    .select(
      "branch_id, grade_id, stream_id, total_seats, pending_seats, reserved_seats, enrolled_seats, waitlist_capacity, waitlist_count"
    )
    .eq("academic_year_id", openYear.id)

  // Fetch stream configs
  const { data: streamConfigs } = await adminClient
    .from("branch_grade_stream_configs")
    .select(`
      branch_id,
      grade_id,
      stream_id,
      streams!inner (id, name)
    `)
    .eq("academic_year_id", openYear.id)
    .eq("is_active", true)

  // Fetch fee structures (active ones only)
  const { data: feeStructures } = await adminClient
    .from("fee_structures")
    .select(
      "branch_id, grade_id, stream_id, total_amount, registration_fee, first_month_fee"
    )
    .eq("academic_year_id", openYear.id)
    .is("effective_until", null)

  // Build structured availability data
  const availability: Record<
    string,
    {
      branchId: string
      branchName: string
      branchCode: string
      gradeId: string
      gradeName: string
      gradeLevelOrder: number
      streamId: string | null
      streamName: string | null
      totalSeats: number
      availableSeats: number
      waitlistCapacity: number
      waitlistCount: number
      isFull: boolean
      waitlistOpen: boolean
      feeAmount: number | null
    }
  > = {}

  for (const config of configs ?? []) {
    const branch = Array.isArray(config.branches)
      ? config.branches[0]
      : config.branches
    const grade = Array.isArray(config.grades)
      ? config.grades[0]
      : config.grades

    if (!branch || !grade || !branch.is_active) continue

    // Check if this grade has streams
    const gradeStreams = (streamConfigs ?? []).filter(
      (sc) =>
        sc.branch_id === config.branch_id &&
        sc.grade_id === config.grade_id
    )

    if (gradeStreams.length > 0) {
      // Add one entry per stream
      for (const sc of gradeStreams) {
        const stream = Array.isArray(sc.streams)
          ? sc.streams[0]
          : sc.streams
        if (!stream) continue

        const cap = (capacities ?? []).find(
          (c) =>
            c.branch_id === config.branch_id &&
            c.grade_id === config.grade_id &&
            c.stream_id === sc.stream_id
        )

        const fee = (feeStructures ?? []).find(
          (f) =>
            f.branch_id === config.branch_id &&
            f.grade_id === config.grade_id &&
            f.stream_id === sc.stream_id
        )

        const totalSeats = cap?.total_seats ?? 0
        const usedSeats =
          (cap?.pending_seats ?? 0) +
          (cap?.reserved_seats ?? 0) +
          (cap?.enrolled_seats ?? 0)
        const availableSeats = Math.max(0, totalSeats - usedSeats)

        const key = `${config.branch_id}_${config.grade_id}_${sc.stream_id}`
        availability[key] = {
          branchId: config.branch_id,
          branchName: branch.name,
          branchCode: branch.code,
          gradeId: config.grade_id,
          gradeName: grade.name,
          gradeLevelOrder: grade.level_order,
          streamId: sc.stream_id,
          streamName: stream.name,
          totalSeats,
          availableSeats,
          waitlistCapacity: cap?.waitlist_capacity ?? 0,
          waitlistCount: cap?.waitlist_count ?? 0,
          isFull: availableSeats === 0,
          // NEW — correct comparison
          waitlistOpen:
          availableSeats === 0 &&
          (cap?.waitlist_count ?? 0) < (cap?.waitlist_capacity ?? 0),
          feeAmount: fee?.total_amount ?? null,
        }
      }
    } else {
      // No streams — single entry
      const cap = (capacities ?? []).find(
        (c) =>
          c.branch_id === config.branch_id &&
          c.grade_id === config.grade_id &&
          c.stream_id === null
      )

      const fee = (feeStructures ?? []).find(
        (f) =>
          f.branch_id === config.branch_id &&
          f.grade_id === config.grade_id &&
          f.stream_id === null
      )

      const totalSeats = cap?.total_seats ?? 0
      const usedSeats =
        (cap?.pending_seats ?? 0) +
        (cap?.reserved_seats ?? 0) +
        (cap?.enrolled_seats ?? 0)
      const availableSeats = Math.max(0, totalSeats - usedSeats)

      const key = `${config.branch_id}_${config.grade_id}_null`
      availability[key] = {
        branchId: config.branch_id,
        branchName: branch.name,
        branchCode: branch.code,
        gradeId: config.grade_id,
        gradeName: grade.name,
        gradeLevelOrder: grade.level_order,
        streamId: null,
        streamName: null,
        totalSeats,
        availableSeats,
        waitlistCapacity: cap?.waitlist_capacity ?? 0,
        waitlistCount: cap?.waitlist_count ?? 0,
        isFull: availableSeats === 0,
        // NEW — correct comparison
        waitlistOpen:
          availableSeats === 0 &&
          (cap?.waitlist_count ?? 0) < (cap?.waitlist_capacity ?? 0),
        feeAmount: fee?.total_amount ?? null,
      }
    }
  }

  return NextResponse.json({
    openYear: { id: openYear.id, name: openYear.name },
    availability: Object.values(availability).sort(
      (a, b) => a.gradeLevelOrder - b.gradeLevelOrder
    ),
  })
}