// app/api/enrollment/academic-year/route.ts
// Purpose: Get the currently OPEN academic year and enrollment status
// Who can call it: authenticated guardians only
// Returns: current open year or null with clear status message

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

  if (!userData || userData.role !== "GUARDIAN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Find the currently OPEN academic year
  const { data: openYear } = await adminClient
    .from("academic_years")
    .select("id, name, start_year, end_year, status")
    .eq("status", "OPEN")
    .single()

  if (!openYear) {
    // Check if there is a year in CONFIGURATION (coming soon)
    const { data: configYear } = await adminClient
      .from("academic_years")
      .select("name")
      .eq("status", "CONFIGURATION")
      .single()

    return NextResponse.json({
      isOpen: false,
      openYear: null,
      message: configYear
        ? `Enrollment for ${configYear.name} is not yet open. Please check back later.`
        : "Enrollment is currently closed. Please check back later.",
    })
  }

  return NextResponse.json({
    isOpen: true,
    openYear,
    message: `Enrollment is open for academic year ${openYear.name}.`,
  })
}