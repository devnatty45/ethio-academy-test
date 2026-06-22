// app/api/master/audit-logs/export/route.ts
// Purpose: Export filtered audit logs as CSV
// Who can call it: MASTER_ADMIN only

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { isMfaVerifiedInSession } from "@/lib/supabase/session"
import { writeAuditLog } from "@/lib/utils/audit"

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return ""
  const str =
    typeof value === "object"
      ? JSON.stringify(value)
      : String(value)
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

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

  let query = adminClient
    .from("audit_logs")
    .select(`
      id, actor_id, actor_role, action_type, target_table,
      target_id, old_value, new_value, created_at,
      users (full_name, email)
    `)
    .order("created_at", { ascending: false })
    .limit(10000)

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

  const { data: logs, error } = await query

  if (error) {
    return NextResponse.json(
      { error: "Could not fetch audit logs" },
      { status: 500 }
    )
  }

  const headers = [
    "ID",
    "Timestamp",
    "Actor ID",
    "Actor Name",
    "Actor Role",
    "Action Type",
    "Target Table",
    "Target ID",
    "Old Value",
    "New Value",
  ]

  const rows = (logs ?? []).map((l) => {
    const actor = Array.isArray(l.users) ? l.users[0] : l.users
    return [
      l.id,
      l.created_at,
      l.actor_id ?? "",
      actor?.full_name ?? actor?.email ?? "System",
      l.actor_role,
      l.action_type,
      l.target_table,
      l.target_id ?? "",
      l.old_value,
      l.new_value,
    ].map(escapeCSV)
  })

  const csv = [
    headers.join(","),
    ...rows.map((r) => r.join(",")),
  ].join("\n")

  // Log the export itself
  await writeAuditLog({
    actorId: user.id,
    actorRole: "MASTER_ADMIN",
    actionType: "AUDIT_LOG_EXPORTED",
    targetTable: "audit_logs",
    targetId: undefined,
    newValue: {
      filters: {
        actorId,
        actorRole,
        actionType,
        targetTable,
        targetId,
        dateFrom,
        dateTo,
      },
      rowCount: logs?.length ?? 0,
    },
  })

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="audit-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}