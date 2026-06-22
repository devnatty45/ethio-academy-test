// lib/utils/enrollment-review.ts
// Helpers for the admin enrollment review workflow

import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Check if all required documents for an enrollment are VERIFIED.
 * Returns true only when every document is VERIFIED — none PENDING or REJECTED.
 */
export async function areAllDocumentsVerified(
  enrollmentId: string
): Promise<boolean> {
  const adminClient = createAdminClient()

  const { data: documents } = await adminClient
    .from("enrollment_documents")
    .select("verification_status")
    .eq("enrollment_id", enrollmentId)

  if (!documents || documents.length === 0) return false

  return documents.every((d) => d.verification_status === "VERIFIED")
}

/**
 * Check if any documents are REJECTED for an enrollment.
 */
export async function hasRejectedDocuments(
  enrollmentId: string
): Promise<boolean> {
  const adminClient = createAdminClient()

  const { count } = await adminClient
    .from("enrollment_documents")
    .select("id", { count: "exact", head: true })
    .eq("enrollment_id", enrollmentId)
    .eq("verification_status", "REJECTED")

  return (count ?? 0) > 0
}

/**
 * Get document verification summary for an enrollment.
 */
export async function getDocumentSummary(enrollmentId: string): Promise<{
  total: number
  verified: number
  rejected: number
  pending: number
  allVerified: boolean
  hasRejections: boolean
}> {
  const adminClient = createAdminClient()

  const { data: documents } = await adminClient
    .from("enrollment_documents")
    .select("verification_status")
    .eq("enrollment_id", enrollmentId)

  const total = documents?.length ?? 0
  const verified =
    documents?.filter((d) => d.verification_status === "VERIFIED")
      .length ?? 0
  const rejected =
    documents?.filter((d) => d.verification_status === "REJECTED")
      .length ?? 0
  const pending =
    documents?.filter((d) => d.verification_status === "PENDING")
      .length ?? 0

  return {
    total,
    verified,
    rejected,
    pending,
    allVerified: total > 0 && verified === total,
    hasRejections: rejected > 0,
  }
}