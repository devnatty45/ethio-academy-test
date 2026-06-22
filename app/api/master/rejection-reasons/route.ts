// app/api/master/rejection-reasons/route.ts
// Purpose: List and create predefined rejection reasons
// Who can call it: MASTER_ADMIN only

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSensitiveActionVerified } from "@/lib/utils/sensitive-action"
import { writeAuditLog } from "@/lib/utils/audit"

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

  const { data: reasons, error } = await adminClient
    .from("predefined_rejection_reasons")
    .select("id, doc_type, reason_text, is_active, created_at, updated_at")
    .order("doc_type")
    .order("reason_text")

  if (error) {
    return NextResponse.json(
      { error: "Could not fetch rejection reasons" },
      { status: 500 }
    )
  }

  return NextResponse.json({ reasons: reasons ?? [] })
}

const createReasonSchema = z.object({
  docType: z.string().min(1).max(100).trim(),
  reasonText: z.string().min(5).max(500).trim(),
})

export async function POST(request: NextRequest) {
  const result = await requireSensitiveActionVerified()
  if (result instanceof NextResponse) return result
  const masterAdmin = result

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const parsed = createReasonSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { docType, reasonText } = parsed.data
  const adminClient = createAdminClient()

  // Check for duplicate
  const { data: existing } = await adminClient
    .from("predefined_rejection_reasons")
    .select("id")
    .eq("doc_type", docType)
    .eq("reason_text", reasonText)
    .single()

  if (existing) {
    return NextResponse.json(
      { error: "This reason already exists for this document type" },
      { status: 409 }
    )
  }

  const { data: newReason, error: insertError } = await adminClient
    .from("predefined_rejection_reasons")
    .insert({ doc_type: docType, reason_text: reasonText, is_active: true })
    .select("id")
    .single()

  if (insertError || !newReason) {
    return NextResponse.json(
      { error: "Could not create reason" },
      { status: 500 }
    )
  }

  await writeAuditLog({
    actorId: masterAdmin.id,
    actorRole: "MASTER_ADMIN",
    actionType: "REJECTION_REASON_CREATED",
    targetTable: "predefined_rejection_reasons",
    targetId: newReason.id,
    newValue: { docType, reasonText },
  })

  return NextResponse.json({ success: true })
}