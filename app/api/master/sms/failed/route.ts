// app/api/master/sms/failed/route.ts
// Purpose: List failed SMS records with filters
// Who can call it: MASTER_ADMIN only

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

  if (!userData || userData.role !== "MASTER_ADMIN") {
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
  const dateFrom = searchParams.get("dateFrom")
  const dateTo = searchParams.get("dateTo")

  let query = adminClient
    .from("sms_queue")
    .select(
      "id, recipient_phone, message_body, trigger_event, retry_count, last_attempted_at, created_at, related_id",
      { count: "exact" }
    )
    .eq("status", "FAILED")
    .order("created_at", { ascending: false })
    .limit(200)

  if (dateFrom) {
    query = query.gte("created_at", new Date(dateFrom).toISOString())
  }
  if (dateTo) {
    const end = new Date(dateTo)
    end.setHours(23, 59, 59, 999)
    query = query.lte("created_at", end.toISOString())
  }

  const { data: failed, error, count } = await query

  if (error) {
    return NextResponse.json(
      { error: "Could not fetch failed SMS" },
      { status: 500 }
    )
  }

  return NextResponse.json({ failed: failed ?? [], total: count ?? 0 })
}