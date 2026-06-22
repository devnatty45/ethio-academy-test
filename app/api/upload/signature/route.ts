// app/api/upload/signature/route.ts
// Purpose: Generate a signed Cloudinary upload signature for direct client upload
// Who can call it: authenticated guardians only
// The client uploads directly to Cloudinary using this signature
// Server never proxies file content

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  generateUploadSignature,
  buildDocumentFolder,
  buildDocumentPublicId,
  ALLOWED_FORMATS,
  type AllowedFormat,
} from "@/lib/cloudinary/server"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const PROFILE_PLACEHOLDER_ID = "00000000-0000-0000-0000-000000000000"

const signatureRequestSchema = z.object({
  docType: z.string().min(1).max(50),
  academicYearName: z.string().min(1).max(20),
  branchId: z.string().uuid(),
  studentId: z.string().uuid(),
  enrollmentId: z.string().uuid(),
  fileExtension: z.enum([...ALLOWED_FORMATS]),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

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

  const result = signatureRequestSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { docType, academicYearName, branchId, studentId, enrollmentId } =
    result.data

  // Profile uploads use placeholder IDs — skip enrollment ownership check
  const isProfileUpload =
    enrollmentId === PROFILE_PLACEHOLDER_ID &&
    branchId === PROFILE_PLACEHOLDER_ID

  if (!isProfileUpload) {
    // Verify the enrollment belongs to this guardian
    const { data: enrollment } = await adminClient
      .from("enrollments")
      .select("id, guardian_id")
      .eq("id", enrollmentId)
      .eq("guardian_id", user.id)
      .single()

    if (!enrollment) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  const folder = buildDocumentFolder({
    academicYearName,
    branchId: isProfileUpload ? user.id : branchId,
    studentId,
    enrollmentId: isProfileUpload ? "profile" : enrollmentId,
  })

  const publicId = buildDocumentPublicId(docType)
  const signatureData = generateUploadSignature({ folder, publicId })

  return NextResponse.json(signatureData)
}