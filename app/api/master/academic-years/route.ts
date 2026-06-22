// app/api/master/academic-years/route.ts
// Purpose: List all academic years and create new ones
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

  const { data: years, error } = await adminClient
    .from("academic_years")
    .select("id, name, start_year, end_year, status, created_at, updated_at")
    .order("start_year", { ascending: false })

  if (error) {
    return NextResponse.json(
      { error: "Could not fetch academic years" },
      { status: 500 }
    )
  }

  return NextResponse.json({ years: years ?? [] })
}

// POST — create a new academic year
const createYearSchema = z.object({
  startYear: z
    .number()
    .int()
    .min(2020)
    .max(2100),
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

  const parsed = createYearSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { startYear } = parsed.data
  const endYear = startYear + 1
  const name = `${startYear}/${endYear}`

  const adminClient = createAdminClient()

  // Check for duplicate
  const { data: existing } = await adminClient
    .from("academic_years")
    .select("id")
    .eq("name", name)
    .single()

  if (existing) {
    return NextResponse.json(
      { error: `Academic year ${name} already exists` },
      { status: 409 }
    )
  }

  const { data: newYear, error: insertError } = await adminClient
    .from("academic_years")
    .insert({
      name,
      start_year: startYear,
      end_year: endYear,
      status: "CONFIGURATION",
    })
    .select("id, name, status")
    .single()

  if (insertError || !newYear) {
    return NextResponse.json(
      { error: "Could not create academic year" },
      { status: 500 }
    )
  }

  // Create platform billing counter for this year
  await adminClient
    .from("platform_billing_counter")
    .insert({
      academic_year_id: newYear.id,
      total_successful_enrollments: 0,
    })

  await writeAuditLog({
    actorId: masterAdmin.id,
    actorRole: "MASTER_ADMIN",
    actionType: "ACADEMIC_YEAR_CREATED",
    targetTable: "academic_years",
    targetId: newYear.id,
    newValue: { name, start_year: startYear, end_year: endYear },
  })

  return NextResponse.json({ year: newYear })
}