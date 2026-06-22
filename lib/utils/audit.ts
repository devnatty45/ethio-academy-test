// lib/utils/audit.ts
// Audit log helper — used throughout the application to log events
// Every sensitive action, state change, and admin operation must be logged

import { createAdminClient } from "@/lib/supabase/admin"
import type { UserRole } from "@/types/database"

interface AuditLogEntry {
  actorId: string | null
  actorRole: UserRole | string | null
  actionType: string
  targetTable?: string
  targetId?: string
  oldValue?: Record<string, unknown>
  newValue?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

/**
 * Write an entry to the audit_logs table.
 * Uses admin client — audit logs bypass RLS intentionally.
 * Fire-and-forget safe: errors are caught and logged to console only.
 * Never throws — audit log failure must never block the main operation.
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    const supabase = createAdminClient()
    await supabase.from("audit_logs").insert({
      actor_id: entry.actorId,
      actor_role: entry.actorRole,
      action_type: entry.actionType,
      target_table: entry.targetTable ?? null,
      target_id: entry.targetId ?? null,
      old_value: entry.oldValue ?? null,
      new_value: entry.newValue ?? null,
      ip_address: entry.ipAddress ?? null,
      user_agent: entry.userAgent ?? null,
    })
  } catch (err) {
    // Never throw — audit log failure must not block the caller
    console.error("[AuditLog] Failed to write audit log:", err)
  }
}