// app/api/upload/validate/route.ts
// Purpose: Validate a Cloudinary upload via magic bytes after upload completes
// Who can call it: authenticated GUARDIAN only
// Called by client after successful Cloudinary upload, before creating doc record

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { validateAndCleanup } from "@/lib/utils/magic-bytes"
import { writeAuditLog } from "@/lib/utils/audit"

const validateSchema = z.object({
  publicId: z.string().min(1).max(500),
  enrollmentId: z.string().uuid(),
  docType: z.string().min(1).max(100),
})

export async function POST(request: NextRequest) {
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

  if (!userData || userData.role !== "GUARDIAN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const result = validateSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { publicId, enrollmentId, docType } = result.data

  // Verify enrollment belongs to this guardian
  const { data: enrollment } = await adminClient
    .from("enrollments")
    .select("id, guardian_id")
    .eq("id", enrollmentId)
    .eq("guardian_id", user.id)
    .single()

  if (!enrollment) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!
  const { valid, reason } = await validateAndCleanup(
    publicId,
    cloudName
  )

  if (!valid) {
    await writeAuditLog({
      actorId: user.id,
      actorRole: "GUARDIAN",
      actionType: "INVALID_FILE_UPLOAD_REJECTED",
      targetTable: "enrollments",
      targetId: enrollmentId,
      newValue: {
        public_id: publicId,
        doc_type: docType,
        reason,
      },
    })

    return NextResponse.json(
      {
        valid: false,
        error:
          "File type is not allowed. Only JPG, PNG, and PDF files are accepted. Please upload a valid file.",
      },
      { status: 400 }
    )
  }

  return NextResponse.json({ valid: true })
}