// app/api/enrollment/[enrollmentId]/required-documents/route.ts
// Purpose: Get required documents for a specific enrollment
// Who can call it: guardian who owns this enrollment

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const paramsSchema = z.object({ enrollmentId: z.string().uuid() })

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

  // Fetch enrollment and verify ownership
  const { data: enrollment } = await adminClient
    .from("enrollments")
    .select(
      "id, student_id, guardian_id, grade_id, student_category, status"
    )
    .eq("id", enrollmentId)
    .eq("guardian_id", user.id)
    .single()

  if (!enrollment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Fetch applicable document requirement rules
  const { data: rules } = await adminClient
    .from("document_requirement_rules")
    .select(
      "id, doc_type, student_category, is_required, is_reusable, requires_fresh_upload, applies_when_entering_grade_id"
    )
    .eq("is_active", true)
    .or(
      `student_category.eq.ALL,student_category.eq.${enrollment.student_category}`
    )

  // Filter rules applicable to this enrollment
  const applicableRules = (rules ?? []).filter((rule) => {
    if (rule.applies_when_entering_grade_id) {
      return rule.applies_when_entering_grade_id === enrollment.grade_id
    }
    return true
  })

  // For EXISTING/RETURNING — find reusable documents from previous enrollment
  const reusableDocuments: Record<
    string,
    { enrollmentId: string; publicId: string }
  > = {}

  if (
    enrollment.student_category === "EXISTING" ||
    enrollment.student_category === "RETURNING"
  ) {
    const { data: previousDocs } = await adminClient
      .from("enrollment_documents")
      .select(
        "doc_type, cloudinary_public_id, enrollment_id, verification_status"
      )
      .eq("student_id", enrollment.student_id)
      .eq("verification_status", "VERIFIED")
      .neq("enrollment_id", enrollmentId)
      .order("uploaded_at", { ascending: false })

    const seenTypes = new Set<string>()
    for (const doc of previousDocs ?? []) {
      if (!seenTypes.has(doc.doc_type)) {
        seenTypes.add(doc.doc_type)
        reusableDocuments[doc.doc_type] = {
          enrollmentId: doc.enrollment_id,
          publicId: doc.cloudinary_public_id,
        }
      }
    }
  }

  // Fetch this enrollment's OWN existing documents — anything uploaded
  // previously on this exact enrollment (even through reject/resubmit/
  // waitlist cycles) that isn't currently REJECTED should NOT be asked
  // for again.
  const { data: ownDocuments } = await adminClient
    .from("enrollment_documents")
    .select("doc_type, cloudinary_public_id, verification_status")
    .eq("enrollment_id", enrollmentId)

  const ownDocsByType = new Map(
    (ownDocuments ?? []).map((d) => [d.doc_type, d])
  )

  // Build final required documents list
  const requiredDocuments = applicableRules
    .filter((rule) => rule.is_required)
    .map((rule) => {
      const ownDoc = ownDocsByType.get(rule.doc_type)
      const alreadyOnThisEnrollment =
        !!ownDoc && ownDoc.verification_status !== "REJECTED"

      return {
        docType: rule.doc_type,
        studentCategory: rule.student_category,
        isReusable: rule.is_reusable,
        requiresFreshUpload: rule.requires_fresh_upload,
        reusedFrom: rule.is_reusable
          ? (reusableDocuments[rule.doc_type] ?? null)
          : null,
        needsUpload:
          !alreadyOnThisEnrollment &&
          (!rule.is_reusable || !reusableDocuments[rule.doc_type]),
        existingPublicId: ownDoc?.cloudinary_public_id ?? null,
        existingVerificationStatus: ownDoc?.verification_status ?? null,
      }
    })

  return NextResponse.json({
    enrollmentId,
    studentCategory: enrollment.student_category,
    requiredDocuments,
  })
}