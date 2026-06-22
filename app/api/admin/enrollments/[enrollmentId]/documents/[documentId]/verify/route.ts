// app/api/admin/enrollments/[enrollmentId]/documents/[documentId]/verify/route.ts
// Purpose: Branch Admin verifies or rejects a specific document
// Who can call it: BRANCH_ADMIN for their branch, MASTER_ADMIN for any

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { writeAuditLog } from "@/lib/utils/audit"

const paramsSchema = z.object({
  enrollmentId: z.string().uuid(),
  documentId: z.string().uuid(),
})

const verifySchema = z.union([
  z.object({
    action: z.literal("VERIFY"),
  }),
  z.object({
    action: z.literal("REJECT"),
    rejectionReasonId: z.string().uuid(),
    rejectionNote: z.string().max(500).optional(),
  }),
])

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ enrollmentId: string; documentId: string }> }
) {
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

  if (
    !userData ||
    !["BRANCH_ADMIN", "MASTER_ADMIN"].includes(userData.role)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const resolvedParams = await params
  const paramsResult = paramsSchema.safeParse(resolvedParams)
  if (!paramsResult.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { enrollmentId, documentId } = paramsResult.data

  // Verify enrollment is in this admin's branch
  const { data: enrollment } = await adminClient
    .from("enrollments")
    .select("id, branch_id, status")
    .eq("id", enrollmentId)
    .single()

  if (!enrollment) {
    return NextResponse.json(
      { error: "Enrollment not found" },
      { status: 404 }
    )
  }

  if (userData.role === "BRANCH_ADMIN") {
    const { data: adminProfile } = await adminClient
      .from("admin_profiles")
      .select("assigned_branch_id")
      .eq("user_id", user.id)
      .single()

    if (adminProfile?.assigned_branch_id !== enrollment.branch_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  // Only allow verification on PENDING_REVIEW enrollments
  if (enrollment.status !== "PENDING_REVIEW") {
    return NextResponse.json(
      {
        error:
          "Documents can only be verified for enrollments in PENDING_REVIEW status",
      },
      { status: 409 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const parsed = verifySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  // Fetch the document
  const { data: document } = await adminClient
    .from("enrollment_documents")
    .select("id, doc_type, verification_status")
    .eq("id", documentId)
    .eq("enrollment_id", enrollmentId)
    .single()

  if (!document) {
    return NextResponse.json(
      { error: "Document not found" },
      { status: 404 }
    )
  }

  const oldStatus = document.verification_status

  if (parsed.data.action === "VERIFY") {
    await adminClient
      .from("enrollment_documents")
      .update({
        verification_status: "VERIFIED",
        rejection_reason_id: null,
        rejection_note: null,
        verified_by: user.id,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId)
  } else {
    // REJECT
    await adminClient
      .from("enrollment_documents")
      .update({
        verification_status: "REJECTED",
        rejection_reason_id: parsed.data.rejectionReasonId,
        rejection_note: parsed.data.rejectionNote ?? null,
        verified_by: user.id,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId)
  }

  await writeAuditLog({
    actorId: user.id,
    actorRole: userData.role,
    actionType:
      parsed.data.action === "VERIFY"
        ? "DOCUMENT_VERIFIED"
        : "DOCUMENT_REJECTED",
    targetTable: "enrollment_documents",
    targetId: documentId,
    oldValue: { verification_status: oldStatus },
    newValue: {
      verification_status:
        parsed.data.action === "VERIFY" ? "VERIFIED" : "REJECTED",
      doc_type: document.doc_type,
      ...(parsed.data.action === "REJECT" && {
        rejection_reason_id: parsed.data.rejectionReasonId,
        rejection_note: parsed.data.rejectionNote,
      }),
    },
  })

  return NextResponse.json({ success: true })
}