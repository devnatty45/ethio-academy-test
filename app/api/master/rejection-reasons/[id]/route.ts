// app/api/master/rejection-reasons/[id]/route.ts
// Purpose: Toggle rejection reason active status or update text
// Who can call it: MASTER_ADMIN only

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSensitiveActionVerified } from "@/lib/utils/sensitive-action"
import { writeAuditLog } from "@/lib/utils/audit"

const paramsSchema = z.object({ id: z.string().uuid() })

const updateReasonSchema = z.object({
  isActive: z.boolean().optional(),
  reasonText: z.string().min(5).max(500).trim().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireSensitiveActionVerified()
  if (result instanceof NextResponse) return result
  const masterAdmin = result

  const resolvedParams = await params
  const paramsResult = paramsSchema.safeParse(resolvedParams)
  if (!paramsResult.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const reasonId = paramsResult.data.id

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const parsed = updateReasonSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { isActive, reasonText } = parsed.data

  if (isActive === undefined && reasonText === undefined) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const adminClient = createAdminClient()

  const { data: reason } = await adminClient
    .from("predefined_rejection_reasons")
    .select("id, doc_type, reason_text, is_active")
    .eq("id", reasonId)
    .single()

  if (!reason) {
    return NextResponse.json(
      { error: "Reason not found" },
      { status: 404 }
    )
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (isActive !== undefined) updates.is_active = isActive
  if (reasonText !== undefined) updates.reason_text = reasonText

  const { error: updateError } = await adminClient
    .from("predefined_rejection_reasons")
    .update(updates)
    .eq("id", reasonId)

  if (updateError) {
    return NextResponse.json(
      { error: "Could not update reason" },
      { status: 500 }
    )
  }

  await writeAuditLog({
    actorId: masterAdmin.id,
    actorRole: "MASTER_ADMIN",
    actionType: "REJECTION_REASON_UPDATED",
    targetTable: "predefined_rejection_reasons",
    targetId: reasonId,
    oldValue: {
      reason_text: reason.reason_text,
      is_active: reason.is_active,
    },
    newValue: updates,
  })

  return NextResponse.json({ success: true })
}