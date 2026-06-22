// app/api/master/mfa/reverify/status/route.ts
// Purpose: Check if sensitive action re-verification is still valid
// Who can call it: authenticated MASTER_ADMIN only
// Returns: { verified: boolean, expiresInSeconds: number | null }

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { cookies } from "next/headers"
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

  const cookieStore = await cookies()
  const cookie = cookieStore.get(`mfa_action_verified_${user.id}`)

  if (!cookie?.value) {
    return NextResponse.json({ verified: false, expiresInSeconds: null })
  }

  const verifiedAt = parseInt(cookie.value, 10)
  if (isNaN(verifiedAt)) {
    return NextResponse.json({ verified: false, expiresInSeconds: null })
  }

  const fifteenMinutes = 15 * 60 * 1000
  const elapsed = Date.now() - verifiedAt
  const remaining = fifteenMinutes - elapsed

  if (remaining <= 0) {
    return NextResponse.json({ verified: false, expiresInSeconds: null })
  }

  return NextResponse.json({
    verified: true,
    expiresInSeconds: Math.floor(remaining / 1000),
  })
}