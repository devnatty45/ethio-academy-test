// app/api/master/streams/route.ts
// Purpose: List all streams
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

  // Allow both MASTER_ADMIN and BRANCH_ADMIN to view available streams
  if (!userData || (userData.role !== "MASTER_ADMIN" && userData.role !== "BRANCH_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data: streams, error } = await adminClient
    .from("streams")
    .select("id, name, is_active, created_at")
    .order("name", { ascending: true })

  if (error) {
    return NextResponse.json(
      { error: "Could not fetch streams" },
      { status: 500 }
    )
  }

  // Fetch Chereta branch for display
  const { data: chebranch } = await adminClient
    .from("branches")
    .select("id, name")
    .eq("code", "CHERETA")
    .single()

  return NextResponse.json({
    streams: streams ?? [],
    chebranch: chebranch ?? null,
  })
}