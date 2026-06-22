// components/guardian/resubmit-enrollment-client.tsx
// Redesigned resubmission client with modern UI

"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import DocumentUploadItem from "@/components/guardian/document-upload-item"

interface DocumentRecord {
  id: string
  doc_type: string
  verification_status: string
  rejection_note: string | null
  cloudinary_public_id: string
  predefined_rejection_reasons?: { reason_text: string } | null
}

interface ResubmitEnrollmentClientProps {
  enrollmentId: string
  studentId: string
  branchId: string
  academicYearName: string
}

const DOC_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  guardian_photo: { label: "Guardian Photo", icon: "👤" },
  student_photo: { label: "Student Photo", icon: "🧑" },
  national_id_front: { label: "National ID — Front", icon: "🪪" },
  national_id_back: { label: "National ID — Back", icon: "🪪" },
  birth_certificate: { label: "Birth Certificate", icon: "📜" },
  grade_certificate: { label: "Grade Certificate", icon: "🎓" },
  grade_6_exam_cert: { label: "Grade 6 Exam Certificate", icon: "📝" },
  grade_8_exam_cert: { label: "Grade 8 Exam Certificate", icon: "📝" },
}

export default function ResubmitEnrollmentClient({
  enrollmentId,
  studentId,
  branchId,
  academicYearName,
}: ResubmitEnrollmentClientProps) {
  const router = useRouter()
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fixedTypes, setFixedTypes] = useState<Set<string>>(new Set())
  const [progress, setProgress] = useState(0)

  const fetchDocuments = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/enrollment/${enrollmentId}/documents`
      )
      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? "Could not load documents")
        return
      }

      setDocuments(data.documents ?? [])
    } catch {
      setError("Could not load documents")
    } finally {
      setLoading(false)
    }
  }, [enrollmentId])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  function handleUploadComplete(docType: string) {
    setFixedTypes((prev) => {
      const newSet = new Set([...prev, docType])
      const rejected = documents.filter(d => d.verification_status === "REJECTED")
      setProgress((newSet.size / rejected.length) * 100)
      return newSet
    })
  }

  const rejectedDocs = documents.filter(
    (d) => d.verification_status === "REJECTED"
  )
  const verifiedDocs = documents.filter(
    (d) => d.verification_status === "VERIFIED"
  )

  const allFixed = rejectedDocs.every((d) =>
    fixedTypes.has(d.doc_type)
  )

  async function handleResubmit() {
    setError(null)

    if (!allFixed) {
      setError("Please replace all rejected documents first")
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch(
        `/api/enrollment/${enrollmentId}/resubmit`,
        { method: "POST" }
      )

      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? "Could not resubmit application")
        return
      }

      router.push(`/dashboard/guardian/enrollments/${enrollmentId}`)
      router.refresh()
    } catch {
      setError("Could not resubmit application. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-[#6c63ff]/20 border-t-[#6c63ff] animate-spin" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Loading application details...
            </p>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-gray-100/50 dark:border-white/5">
                <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-white/10" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 rounded bg-gray-200 dark:bg-white/10" />
                  <div className="h-2 w-24 rounded bg-gray-100 dark:bg-white/5" />
                </div>
                <div className="w-20 h-8 rounded-lg bg-gray-200 dark:bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const rejectedCount = rejectedDocs.length
  const fixedCount = fixedTypes.size
  const remainingCount = rejectedCount - fixedCount

  return (
    <div className="space-y-6">
      {/* Error message */}
      {error && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50/80 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20">
          <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Progress Overview */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Fix Required Documents
            </h3>
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
              {fixedCount} / {rejectedCount} fixed
            </span>
          </div>
          {rejectedCount > 0 && (
            <span className="text-xs font-medium text-red-500">
              {remainingCount} remaining
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-2 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
          <div 
            className="h-full rounded-full bg-linear-to-r from-red-500 to-[#6c63ff] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {rejectedCount === 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200/50 dark:border-emerald-800/20">
            <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              No rejected documents found. Your application is ready for review.
            </p>
          </div>
        )}
      </div>

      {/* Already verified documents — informational only */}
      {verifiedDocs.length > 0 && (
        <div className="rounded-xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200/50 dark:border-emerald-800/20 p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                {verifiedDocs.length} document{verifiedDocs.length === 1 ? "" : "s"} already verified
              </p>
              <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1">
                {verifiedDocs
                  .map(
                    (d) => DOC_TYPE_LABELS[d.doc_type]?.label ?? d.doc_type
                  )
                  .join(", ")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Documents needing replacement */}
      {rejectedDocs.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Documents Requiring Replacement
            </h4>
            <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
              {rejectedCount}
            </span>
          </div>

          <div className="space-y-3">
            {rejectedDocs.map((doc) => {
              const docConfig = DOC_TYPE_LABELS[doc.doc_type] || { 
                label: doc.doc_type, 
                icon: "📄" 
              }
              const isFixed = fixedTypes.has(doc.doc_type)

              return (
                <div
                  key={doc.id}
                  className={`group relative rounded-xl border transition-all duration-300 hover:shadow-md overflow-hidden ${
                    isFixed
                      ? "border-emerald-200 dark:border-emerald-800/30 bg-emerald-50/30 dark:bg-emerald-900/5"
                      : "border-red-200 dark:border-red-800/30 bg-red-50/30 dark:bg-red-900/5"
                  }`}
                >
                  {/* Status bar */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                    isFixed ? "bg-emerald-500" : "bg-red-500"
                  }`} />

                  <div className="pl-4 pr-4 py-4">
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isFixed
                          ? "bg-emerald-500/10 border border-emerald-200/50 dark:border-emerald-800/30"
                          : "bg-red-500/10 border border-red-200/50 dark:border-red-800/30"
                      }`}>
                        <span className="text-lg">{docConfig.icon}</span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-800 dark:text-white">
                            {docConfig.label}
                          </p>
                          {isFixed ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                              Fixed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Needs Fix
                            </span>
                          )}
                        </div>

                        {/* Rejection reason */}
                        {!isFixed && doc.rejection_note && (
                          <div className="mt-1.5 flex items-start gap-1.5">
                            <svg className="w-3 h-3 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-xs text-red-600 dark:text-red-400">
                              {doc.rejection_note}
                            </p>
                          </div>
                        )}

                        {/* Upload component */}
                        <div className="mt-2">
                          <DocumentUploadItem
                            enrollmentId={enrollmentId}
                            docType={doc.doc_type}
                            label={docConfig.label}
                            isRequired={true}
                            isReusable={false}
                            reusedFrom={null}
                            existingPublicId={
                              isFixed ? doc.cloudinary_public_id : null
                            }
                            verificationStatus={
                              isFixed ? null : "REJECTED"
                            }
                            rejectionNote={doc.rejection_note}
                            academicYearName={academicYearName}
                            branchId={branchId}
                            studentId={studentId}
                            onUploadComplete={handleUploadComplete}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Submit button */}
      <div className="pt-4 border-t border-gray-100/50 dark:border-white/5 space-y-3">
        <Button
          className={`w-full rounded-xl py-3 font-semibold transition-all duration-300 ${
            allFixed && rejectedCount > 0
              ? "bg-linear-to-r from-[#6c63ff] to-[#7c73ff] hover:from-[#5a52e0] hover:to-[#6c63ff] text-white shadow-lg shadow-[#6c63ff]/25 hover:shadow-[#6c63ff]/40"
              : rejectedCount === 0
              ? "bg-linear-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
              : "bg-gray-300 dark:bg-gray-700 cursor-not-allowed opacity-60"
          }`}
          onClick={handleResubmit}
          disabled={submitting || (!allFixed && rejectedCount > 0)}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-3">
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
              </svg>
              Resubmitting Application...
            </span>
          ) : allFixed && rejectedCount > 0 ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Resubmit Application
            </span>
          ) : rejectedCount === 0 ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              All Documents Verified ✓
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={2} />
                <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth={2} />
                <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth={2} />
              </svg>
              {remainingCount} document{remainingCount === 1 ? "" : "s"} remaining
            </span>
          )}
        </Button>

        {remainingCount > 0 && (
          <p className="text-xs text-center text-gray-400 dark:text-gray-500">
            Please fix all rejected documents before resubmitting
          </p>
        )}

        {rejectedCount === 0 && (
          <p className="text-xs text-center text-emerald-600 dark:text-emerald-400">
            ✅ All documents are verified. Your application is ready for review.
          </p>
        )}
      </div>

      {/* Status indicators */}
      <div className="flex justify-center gap-6 pt-2">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-[10px] text-gray-400 dark:text-gray-500">Verified</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          <span className="text-[10px] text-gray-400 dark:text-gray-500">Needs Fix</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#6c63ff]" />
          <span className="text-[10px] text-gray-400 dark:text-gray-500">In Progress</span>
        </div>
      </div>
    </div>
  )
}