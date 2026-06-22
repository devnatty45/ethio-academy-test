// components/guardian/post-confirm-documents-client.tsx
// Redesigned post-confirm documents client with modern UI

"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import DocumentUploadItem from "@/components/guardian/document-upload-item"

interface RequiredDocument {
  docType: string
  isReusable: boolean
  reusedFrom: { enrollmentId: string; publicId: string } | null
  needsUpload: boolean
  existingPublicId: string | null
  existingVerificationStatus: string | null
}

interface PostConfirmDocumentsClientProps {
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

export default function PostConfirmDocumentsClient({
  enrollmentId,
  studentId,
  branchId,
  academicYearName,
}: PostConfirmDocumentsClientProps) {
  const router = useRouter()
  const [requiredDocs, setRequiredDocs] = useState<RequiredDocument[]>([])
  const [uploadedTypes, setUploadedTypes] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState(0)

  const fetchRequiredDocs = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/enrollment/${enrollmentId}/required-documents`
      )
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? "Could not load document requirements")
        return
      }
      setRequiredDocs(data.requiredDocuments ?? [])
      const uploaded = new Set<string>()
      for (const doc of data.requiredDocuments ?? []) {
        if (!doc.needsUpload) uploaded.add(doc.docType)
      }
      setUploadedTypes(uploaded)
      const total = data.requiredDocuments?.length || 0
      const uploadedCount = uploaded.size
      setProgress(total > 0 ? (uploadedCount / total) * 100 : 100)
    } catch {
      setError("Could not load document requirements")
    } finally {
      setLoading(false)
    }
  }, [enrollmentId])

  useEffect(() => {
    fetchRequiredDocs()
  }, [fetchRequiredDocs])

  function handleUploadComplete(docType: string) {
    setUploadedTypes((prev) => {
      const newSet = new Set([...prev, docType])
      const total = requiredDocs.length
      const uploadedCount = newSet.size
      setProgress(total > 0 ? (uploadedCount / total) * 100 : 100)
      return newSet
    })
  }

  const allRequiredUploaded = requiredDocs.every((d) =>
    uploadedTypes.has(d.docType)
  )

  async function handleSubmit() {
    setSubmitting(true)
    router.push(`/dashboard/guardian/enrollments/${enrollmentId}`)
    router.refresh()
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Loading document requirements...
            </p>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
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

  if (error) {
    return (
      <div className="flex flex-col items-center text-center py-8">
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Something went wrong</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-sm mb-6">{error}</p>
        <Button
          variant="outline"
          className="rounded-xl border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-[#6c63ff]/40 hover:text-[#6c63ff]"
          onClick={() => router.push(`/dashboard/guardian/enrollments/${enrollmentId}`)}
        >
          Back to Enrollment
        </Button>
      </div>
    )
  }

  const uploadedCount = uploadedTypes.size
  const totalCount = requiredDocs.length

  return (
    <div className="space-y-6">
      {/* Success banner */}
      <div className="relative overflow-hidden rounded-xl bg-linear-to-br from-emerald-50/80 to-emerald-50/30 dark:from-emerald-900/20 dark:to-emerald-900/5 border border-emerald-200/50 dark:border-emerald-800/30 p-4">
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-0 w-20 h-20 bg-emerald-500/10 rounded-full blur-2xl" />
        
        <div className="relative flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              Seat Confirmed ✓
            </p>
            <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 leading-relaxed mt-0.5">
              Upload the required documents below to complete your application.
            </p>
          </div>
        </div>
      </div>

      {/* Progress section */}
      {totalCount > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Required Documents
              </h3>
              <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
                {uploadedCount} / {totalCount} uploaded
              </span>
            </div>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {Math.round(progress)}%
            </span>
          </div>

          <div className="h-2 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
            <div 
              className="h-full rounded-full bg-linear-to-r from-emerald-500 to-[#6c63ff] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Document list */}
      {totalCount === 0 ? (
        <div className="flex flex-col items-center py-8 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
          <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">No documents required</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Your application is complete</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requiredDocs.map((doc) => {
            const docConfig = DOC_TYPE_LABELS[doc.docType] || { 
              label: doc.docType, 
              icon: "📄" 
            }
            const isUploaded = uploadedTypes.has(doc.docType)

            return (
              <div
                key={doc.docType}
                className={`group relative rounded-xl border transition-all duration-300 hover:shadow-md overflow-hidden ${
                  isUploaded
                    ? "border-emerald-200 dark:border-emerald-800/30 bg-emerald-50/30 dark:bg-emerald-900/5"
                    : "border-gray-200 dark:border-white/8 bg-white dark:bg-white/3 hover:border-[#6c63ff]/30"
                }`}
              >
                {/* Status bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                  isUploaded ? "bg-emerald-500" : "bg-[#6c63ff]"
                }`} />

                <div className="pl-4 pr-4 py-4">
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isUploaded
                        ? "bg-emerald-500/10 border border-emerald-200/50 dark:border-emerald-800/30"
                        : "bg-[#6c63ff]/10 border border-[#6c63ff]/20"
                    }`}>
                      <span className="text-lg">{docConfig.icon}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-800 dark:text-white">
                          {docConfig.label}
                        </p>
                        {isUploaded ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            Uploaded
                          </span>
                        ) : doc.isReusable && doc.reusedFrom ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Reused
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={2} />
                              <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth={2} />
                              <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth={2} />
                            </svg>
                            Pending
                          </span>
                        )}
                      </div>

                      {/* Upload component */}
                      <div className="mt-2">
                        <DocumentUploadItem
                          enrollmentId={enrollmentId}
                          docType={doc.docType}
                          label={docConfig.label}
                          isRequired={true}
                          isReusable={doc.isReusable}
                          reusedFrom={doc.reusedFrom}
                          existingPublicId={doc.existingPublicId}
                          verificationStatus={doc.existingVerificationStatus}
                          rejectionNote={null}
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
      )}

      {/* Submit button */}
      <div className="pt-4 border-t border-gray-100/50 dark:border-white/5 space-y-3">
        <Button
          className={`w-full rounded-xl py-3 font-semibold transition-all duration-300 ${
            allRequiredUploaded && totalCount > 0
              ? "bg-linear-to-r from-[#6c63ff] to-[#7c73ff] hover:from-[#5a52e0] hover:to-[#6c63ff] text-white shadow-lg shadow-[#6c63ff]/25 hover:shadow-[#6c63ff]/40"
              : totalCount === 0
              ? "bg-linear-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
              : "bg-gray-300 dark:bg-gray-700 cursor-not-allowed opacity-60"
          }`}
          onClick={handleSubmit}
          disabled={submitting || (!allRequiredUploaded && totalCount > 0)}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-3">
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
              </svg>
              Finishing...
            </span>
          ) : allRequiredUploaded && totalCount > 0 ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Done — View Status
            </span>
          ) : totalCount === 0 ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Continue to Status
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={2} />
                <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth={2} />
                <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth={2} />
              </svg>
              {totalCount - uploadedCount} document{totalCount - uploadedCount === 1 ? "" : "s"} remaining
            </span>
          )}
        </Button>

        {totalCount > 0 && !allRequiredUploaded && (
          <p className="text-xs text-center text-amber-600 dark:text-amber-400">
            ⚠️ Please upload all required documents before proceeding
          </p>
        )}
      </div>

      {/* Status indicators */}
      <div className="flex justify-center gap-6 pt-2">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-[10px] text-gray-400 dark:text-gray-500">Uploaded</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#6c63ff]" />
          <span className="text-[10px] text-gray-400 dark:text-gray-500">Pending</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          <span className="text-[10px] text-gray-400 dark:text-gray-500">Reused</span>
        </div>
      </div>

      {/* Helpful tip */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-900/5 border border-blue-100/50 dark:border-blue-800/20">
        <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">
          💡 Documents marked as "Reused" from previous enrollments don't need to be re-uploaded.
        </p>
      </div>
    </div>
  )
}