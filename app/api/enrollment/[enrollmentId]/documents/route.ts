// app/api/enrollment/[enrollmentId]/documents/route.ts
// Purpose: Create enrollment_documents record after client uploads to Cloudinary
// Who can call it: guardian who owns this enrollment

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const paramsSchema = z.object({ enrollmentId: z.string().uuid() })

const createDocumentSchema = z.object({
  docType: z.string().min(1).max(100),
  cloudinaryPublicId: z.string().min(1).max(500),
  cloudinaryVersion: z.string().optional(),
  isReusedFromEnrollmentId: z.string().uuid().optional(),
})

// GET — list documents for this enrollment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ enrollmentId: string }> }
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

  if (!userData || userData.role !== "GUARDIAN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const resolvedParams = await params
  const paramsResult = paramsSchema.safeParse(resolvedParams)
  if (!paramsResult.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { enrollmentId } = paramsResult.data

  // Verify ownership
  const { data: enrollment } = await adminClient
    .from("enrollments")
    .select("id, guardian_id, student_id, academic_year_id, status")
    .eq("id", enrollmentId)
    .eq("guardian_id", user.id)
    .single()

  if (!enrollment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const { data: documents } = await adminClient
    .from("enrollment_documents")
    .select(
      "id, doc_type, cloudinary_public_id, verification_status, rejection_note, is_reused_from_enrollment_id, uploaded_at"
    )
    .eq("enrollment_id", enrollmentId)
    .order("uploaded_at", { ascending: true })

  return NextResponse.json({ documents: documents ?? [] })
}

// POST — create document record after Cloudinary upload
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ enrollmentId: string }> }
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

  if (!userData || userData.role !== "GUARDIAN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const resolvedParams = await params
  const paramsResult = paramsSchema.safeParse(resolvedParams)
  if (!paramsResult.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { enrollmentId } = paramsResult.data

  // Verify ownership and enrollment is in uploadable state
  const { data: enrollment } = await adminClient
    .from("enrollments")
    .select(
      "id, guardian_id, student_id, academic_year_id, branch_id, status"
    )
    .eq("id", enrollmentId)
    .eq("guardian_id", user.id)
    .single()

  if (!enrollment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }


  // Only allow uploads for PENDING_REVIEW or REJECTED enrollments.
  // WAITLISTED/WAITLIST_NOTIFIED enrollments cannot upload yet — they
  // must wait for a seat and confirm the waitlist offer first.
  if (enrollment.status === "WAITLISTED") {
    return NextResponse.json(
      {
        error:
          "This enrollment is on the waitlist. Document upload will be available once a seat opens up and you confirm your offer.",
        waitlisted: true,
      },
      { status: 409 }
    )
  }

  if (enrollment.status === "WAITLIST_NOTIFIED") {
    return NextResponse.json(
      {
        error:
          "Please confirm your waitlist offer first. Document upload will unlock once you confirm.",
        waitlistNotified: true,
      },
      { status: 409 }
    )
  }

  if (!["PENDING_REVIEW", "REJECTED"].includes(enrollment.status)) {
    return NextResponse.json(
      {
        error: `Documents can only be uploaded for enrollments in PENDING_REVIEW or REJECTED status — current status: ${enrollment.status}`,
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

  const result = createDocumentSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const {
    docType,
    cloudinaryPublicId,
    cloudinaryVersion,
    isReusedFromEnrollmentId,
  } = result.data

  // Check if a document of this type already exists — replace it
  const { data: existingDoc } = await adminClient
    .from("enrollment_documents")
    .select("id")
    .eq("enrollment_id", enrollmentId)
    .eq("doc_type", docType)
    .single()

  if (existingDoc) {
    // Update existing document record
    await adminClient
      .from("enrollment_documents")
      .update({
        cloudinary_public_id: cloudinaryPublicId,
        cloudinary_version: cloudinaryVersion ?? null,
        is_reused_from_enrollment_id:
          isReusedFromEnrollmentId ?? null,
        uploaded_by_guardian_id: user.id,
        uploaded_at: new Date().toISOString(),
        verification_status: "PENDING",
        rejection_reason_id: null,
        rejection_note: null,
        verified_by: null,
        verified_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingDoc.id)

    return NextResponse.json({ success: true, replaced: true })
  }

  // Create new document record
  const { error: insertError } = await adminClient
    .from("enrollment_documents")
    .insert({
      enrollment_id: enrollmentId,
      student_id: enrollment.student_id,
      academic_year_id: enrollment.academic_year_id,
      doc_type: docType,
      cloudinary_public_id: cloudinaryPublicId,
      cloudinary_version: cloudinaryVersion ?? null,
      is_reused_from_enrollment_id:
        isReusedFromEnrollmentId ?? null,
      uploaded_by_guardian_id: user.id,
      uploaded_at: new Date().toISOString(),
      verification_status: "PENDING",
    })

  if (insertError) {
    return NextResponse.json(
      { error: "Could not save document record" },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, replaced: false })
}