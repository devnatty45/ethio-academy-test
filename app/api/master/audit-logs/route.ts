// app/api/master/audit-logs/route.ts
// Purpose: Fetch audit logs with filters — searchable, paginated
// Who can call it: MASTER_ADMIN only

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { isMfaVerifiedInSession } from "@/lib/supabase/session"

const PAGE_SIZE = 50

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
  const actorId = searchParams.get("actorId")
  const actorRole = searchParams.get("actorRole")
  const actionType = searchParams.get("actionType")
  const targetTable = searchParams.get("targetTable")
  const targetId = searchParams.get("targetId")
  const dateFrom = searchParams.get("dateFrom")
  const dateTo = searchParams.get("dateTo")
  const page = parseInt(searchParams.get("page") ?? "1", 10)
  const offset = (page - 1) * PAGE_SIZE

  let query = adminClient
    .from("audit_logs")
    .select(
      `
      id, actor_id, actor_role, action_type, target_table,
      target_id, old_value, new_value, created_at,
      users (full_name, email)
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (actorId) query = query.eq("actor_id", actorId)
  if (actorRole) query = query.eq("actor_role", actorRole)
  if (actionType) query = query.eq("action_type", actionType)
  if (targetTable) query = query.eq("target_table", targetTable)
  if (targetId) query = query.eq("target_id", targetId)
  if (dateFrom)
    query = query.gte("created_at", new Date(dateFrom).toISOString())
  if (dateTo) {
    const end = new Date(dateTo)
    end.setHours(23, 59, 59, 999)
    query = query.lte("created_at", end.toISOString())
  }

  const { data: logs, error, count } = await query

  if (error) {
    return NextResponse.json(
      { error: "Could not fetch audit logs" },
      { status: 500 }
    )
  }

  return NextResponse.json({
    logs: (logs ?? []).map((l) => {
      const actor = Array.isArray(l.users) ? l.users[0] : l.users
      return {
        id: l.id,
        actorId: l.actor_id,
        actorRole: l.actor_role,
        actorName: actor?.full_name ?? actor?.email ?? "System",
        actionType: l.action_type,
        targetTable: l.target_table,
        targetId: l.target_id,
        oldValue: l.old_value,
        newValue: l.new_value,
        createdAt: l.created_at,
      }
    }),
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil((count ?? 0) / PAGE_SIZE),
  })
}