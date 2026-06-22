// app/api/master/streams/[id]/route.ts
// Purpose: Toggle stream active status
// Who can call it: MASTER_ADMIN only with sensitive action verified

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSensitiveActionVerified } from "@/lib/utils/sensitive-action"
import { writeAuditLog } from "@/lib/utils/audit"

const paramsSchema = z.object({ id: z.string().uuid() })
const updateStreamSchema = z.object({ isActive: z.boolean() })

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

  const streamId = paramsResult.data.id

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const parsed = updateStreamSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { isActive } = parsed.data
  const adminClient = createAdminClient()

  const { data: stream } = await adminClient
    .from("streams")
    .select("id, name, is_active")
    .eq("id", streamId)
    .single()

  if (!stream) {
    return NextResponse.json({ error: "Stream not found" }, { status: 404 })
  }

  // Block deactivation if stream has active branch_grade_stream_configs
  if (!isActive) {
    const { count } = await adminClient
      .from("branch_grade_stream_configs")
      .select("id", { count: "exact", head: true })
      .eq("stream_id", streamId)
      .eq("is_active", true)

    if (count && count > 0) {
      return NextResponse.json(
        {
          error: `Cannot deactivate "${stream.name}" — it is assigned to ${count} active branch configuration${count === 1 ? "" : "s"}. Remove it from branch-grade configurations first.`,
        },
        { status: 409 }
      )
    }
  }

  const { error: updateError } = await adminClient
    .from("streams")
    .update({ is_active: isActive })
    .eq("id", streamId)

  if (updateError) {
    return NextResponse.json(
      { error: "Could not update stream" },
      { status: 500 }
    )
  }

  await writeAuditLog({
    actorId: masterAdmin.id,
    actorRole: "MASTER_ADMIN",
    actionType: isActive ? "STREAM_ACTIVATED" : "STREAM_DEACTIVATED",
    targetTable: "streams",
    targetId: streamId,
    oldValue: { is_active: stream.is_active },
    newValue: { is_active: isActive },
  })

  return NextResponse.json({ success: true })
}