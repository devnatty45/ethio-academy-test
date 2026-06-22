// app/api/master/guardians/search/route.ts
// Purpose: Search guardian accounts by name or email for merge tool
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

  if (!userData || userData.role !== "MASTER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")?.trim()

  if (!query || query.length < 2) {
    return NextResponse.json({ guardians: [] })
  }

  const { data: guardians } = await adminClient
    .from("users")
    .select(`
      id, email, full_name, status, created_at,
      guardian_profiles (full_name, phone, is_complete)
    `)
    .eq("role", "GUARDIAN")
    .or(`email.ilike.%${query}%,full_name.ilike.%${query}%`)
    .limit(10)
    .order("created_at", { ascending: false })

  return NextResponse.json({ guardians: guardians ?? [] })
}