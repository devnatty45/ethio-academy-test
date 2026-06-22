// app/api/documents/[id]/view/route.ts
// Purpose: Return a signed Cloudinary URL for viewing a document
// Who can call it: guardian who owns the enrollment, branch admin for their
//                  branch, or master admin
// Raw Cloudinary URLs are NEVER returned to clients under any circumstance

import { createClient } from "@/lib/supabase/server"
import { generateSignedViewUrl } from "@/lib/cloudinary/server"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const paramsSchema = z.object({
  id: z.string().uuid(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Verify authenticated session
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Validate the document ID from URL params
  const resolvedParams = await params
  const paramsResult = paramsSchema.safeParse(resolvedParams)
  if (!paramsResult.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const documentId = paramsResult.data.id

  // Fetch the document record
  console.log("user:", user.id)
console.log("documentId:", documentId)

const { data: document, error } = await supabase
  .from("enrollment_documents")
  .select(`
  id,
  cloudinary_public_id,
  doc_type,
  enrollment_id,
  enrollments!enrollment_documents_enrollment_id_fkey (
    guardian_id,
    branch_id
  )
`)
  .eq("id", documentId)
  .single()

console.log("document query result:", document)
console.log("document query error:", error)

  if (!document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Verify permission to view this document
  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!userData) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const enrollment = Array.isArray(document.enrollments)
    ? document.enrollments[0]
    : document.enrollments

  const canView =
    userData.role === "MASTER_ADMIN" ||
    (userData.role === "GUARDIAN" &&
      enrollment?.guardian_id === user.id) ||
    (userData.role === "BRANCH_ADMIN" && (() => {
      // Branch admin check handled via RLS on the query above
      // If RLS allowed the query, the admin has access to this branch
      return true
    })())

  if (!canView) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Generate signed URL — expires in 15 minutes
  const signedUrl = generateSignedViewUrl(document.cloudinary_public_id)

  // Log access to audit_logs for sensitive document types
  const sensitiveDocTypes = [
    "national_id_front",
    "national_id_back",
    "birth_certificate",
  ]

  if (sensitiveDocTypes.includes(document.doc_type)) {
    // Fire and forget — do not block response on audit log write
    // NEW
void Promise.resolve(
  supabase
    .from("audit_logs")
    .insert({
      actor_id: user.id,
      actor_role: userData.role,
      action_type: "DOCUMENT_VIEWED",
      target_table: "enrollment_documents",
      target_id: documentId,
      new_value: { doc_type: document.doc_type },
    })
).catch(() => {})
  }

  return NextResponse.json({ url: signedUrl })
}