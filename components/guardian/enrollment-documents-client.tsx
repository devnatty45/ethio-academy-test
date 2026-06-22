// components/guardian/enrollment-documents-client.tsx
// Redesigned document upload with modern UI

"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import DocumentUploadItem from "@/components/guardian/document-upload-item"

interface RequiredDocument {
  docType: string
  studentCategory: string
  isReusable: boolean
  requiresFreshUpload: boolean
  reusedFrom: {
    enrollmentId: string
    publicId: string
  } | null
  needsUpload: boolean
}

interface ExistingDocument {
  id: string
  doc_type: string
  cloudinary_public_id: string
  verification_status: string
  rejection_note: string | null
  is_reused_from_enrollment_id: string | null
}

interface EnrollmentDocumentsClientProps {
  studentId: string
  studentName: string
  branchId: string
  gradeId: string
  streamId: string | null
  openYearId: string
  openYearName: string
}

export default function EnrollmentDocumentsClient({
  studentId,
  studentName,
  branchId,
  gradeId,
  streamId,
  openYearId,
  openYearName,
}: EnrollmentDocumentsClientProps) {
  const router = useRouter()
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null)
  const [requiredDocs, setRequiredDocs] = useState<RequiredDocument[]>([])
  const [existingDocs, setExistingDocs] = useState<ExistingDocument[]>([])
  const [uploadedTypes, setUploadedTypes] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<"creating" | "uploading" | "done">("creating")
  const [enrollmentStatus, setEnrollmentStatus] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)

  const createEnrollment = useCallback(async () => {
    try {
      const response = await fetch("/api/enrollment/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, branchId, gradeId, streamId }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 409 && data.enrollmentId) {
          setEnrollmentId(data.enrollmentId)
          if (data.status) setEnrollmentStatus(data.status)
          return
        }
        setError(data.error ?? "Could not create enrollment")
        setLoading(false)
        return
      }

      setEnrollmentId(data.enrollmentId)
      setEnrollmentStatus(data.status)
    } catch {
      setError("Could not create enrollment. Please try again.")
      setLoading(false)
    }
  }, [studentId, branchId, gradeId, streamId])

  const loadRequiredDocs = useCallback(async (eid: string) => {
    try {
      const [reqRes, existingRes] = await Promise.all([
        fetch(`/api/enrollment/${eid}/required-documents`),
        fetch(`/api/enrollment/${eid}/documents`),
      ])

      const [reqData, existingData] = await Promise.all([
        reqRes.json(),
        existingRes.json(),
      ])

      if (!reqRes.ok) {
        setError(reqData.error ?? "Could not load document requirements")
        return
      }

      const docs: RequiredDocument[] = reqData.requiredDocuments ?? []
      setRequiredDocs(docs)

      const existing: ExistingDocument[] = existingData.documents ?? []
      setExistingDocs(existing)

      const uploaded = new Set<string>()
      for (const doc of existing) {
        uploaded.add(doc.doc_type)
      }
      for (const doc of docs) {
        if (doc.reusedFrom && !doc.needsUpload) {
          uploaded.add(doc.docType)
        }
      }

      setUploadedTypes(uploaded)
      setUploadProgress((uploaded.size / docs.length) * 100)
      setStep("uploading")
    } catch {
      setError("Could not load document requirements")
    } finally {
      setLoading(false)
    }
  }, [])

  const hasCreated = useRef(false)

  useEffect(() => {
    if (hasCreated.current) return
    hasCreated.current = true
    createEnrollment()
  }, [createEnrollment])

  useEffect(() => {
    if (enrollmentId) {
      if (enrollmentStatus === "WAITLISTED") {
        setLoading(false)
        setStep("uploading")
      } else {
        loadRequiredDocs(enrollmentId)
      }
    }
  }, [enrollmentId, enrollmentStatus, loadRequiredDocs])

  function handleUploadComplete(docType: string, publicId: string) {
    setUploadedTypes((prev) => {
      const newSet = new Set([...prev, docType])
      setUploadProgress((newSet.size / requiredDocs.length) * 100)
      return newSet
    })
  }

  const allRequiredUploaded = requiredDocs
    .filter((d) => d.isReusable === false || d.needsUpload)
    .every((d) => uploadedTypes.has(d.docType))

  const requiredNotUploaded = requiredDocs
    .filter((d) => d.isReusable === false || d.needsUpload)
    .filter((d) => !uploadedTypes.has(d.docType))
    .map((d) => d.docType)

  async function handleFinalSubmit() {
    if (!enrollmentId) return
    setError(null)

    if (requiredNotUploaded.length > 0) {
      setError("Please upload all required documents before submitting.")
      return
    }

    setSubmitting(true)
    router.push(`/dashboard/guardian/enrollments/${enrollmentId}`)
    router.refresh()
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center py-8">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-[#6c63ff]/20 border-t-[#6c63ff] animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-4 h-4 rounded-full bg-[#6c63ff] animate-pulse" />
            </div>
          </div>
          <p className="mt-4 text-sm font-medium text-gray-600 dark:text-gray-300">
            {step === "creating" ? "Reserving your seat..." : "Loading documents..."}
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Please wait, this may take a moment
          </p>
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

  // ── Error ──
  if (error && !enrollmentId) {
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
          onClick={() => router.push("/dashboard/guardian")}
        >
          ← Back to Dashboard
        </Button>
      </div>
    )
  }

  // ── Waitlisted ──
  if (step === "uploading" && enrollmentId && enrollmentStatus === "WAITLISTED") {
    return (
      <div className="flex flex-col items-center text-center py-6">
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
            <svg className="w-10 h-10 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold">
            !
          </div>
        </div>
        
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          You're on the Waitlist
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md leading-relaxed">
          This grade is currently full. Your seat has been reserved on the waitlist. 
          Document upload will become available once a seat opens up and you confirm your offer.
        </p>
        <div className="mt-4 p-4 bg-amber-50/50 dark:bg-amber-900/5 rounded-xl border border-amber-200/50 dark:border-amber-800/20 w-full max-w-md">
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
            📱 You will receive an SMS notification when it's your turn. No further action is needed right now.
          </p>
        </div>

        <Button
          className="mt-6 w-full max-w-md rounded-xl bg-[#6c63ff] hover:bg-[#5a52e0] text-white font-semibold"
          onClick={() => {
            router.push(`/dashboard/guardian/enrollments/${enrollmentId}`)
            router.refresh()
          }}
        >
          View Enrollment Status →
        </Button>
      </div>
    )
  }

  // ── Upload documents ──
  if (step === "uploading" && enrollmentId) {
    const uploadedCount = requiredDocs.filter((d) => uploadedTypes.has(d.docType)).length
    const totalCount = requiredDocs.length
    const progressPct = totalCount > 0 ? Math.round((uploadedCount / totalCount) * 100) : 100

    return (
      <div className="space-y-8">

        {/* Status header */}
        <div className="flex items-start gap-4 p-4 rounded-xl bg-linear-to-r from-emerald-50/80 to-emerald-50/40 dark:from-emerald-900/20 dark:to-emerald-900/5 border border-emerald-200/50 dark:border-emerald-800/20">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              Seat Reserved ✓
            </p>
            <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 leading-relaxed">
              Your seat is secured. Complete the document upload to finalize your application.
            </p>
          </div>
          <span className="text-xs font-medium px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
            {uploadedCount}/{totalCount}
          </span>
        </div>

        {/* Progress section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Document Upload</h3>
              <span className="text-xs text-gray-400 dark:text-gray-500">· {progressPct}% complete</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="relative h-2 rounded-full bg-gray-100 dark:bg-white/8 overflow-hidden">
            <div
              className="h-full rounded-full bg-linear-to-r from-[#6c63ff] to-[#8b83ff] transition-all duration-700 ease-out"
              style={{ width: `${progressPct}%` }}
            />
            <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
          </div>
        </div>

        {/* Document list */}
        {requiredDocs.length === 0 ? (
          <div className="flex flex-col items-center py-8 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
            <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm text-gray-500 dark:text-gray-400">No documents required</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requiredDocs.map((doc, index) => {
              const existing = existingDocs.find((e) => e.doc_type === doc.docType)
              const isUploaded = uploadedTypes.has(doc.docType)
              const isRequired = doc.isReusable === false || doc.needsUpload

              return (
                <div
                  key={doc.docType}
                  className={`group relative rounded-xl border transition-all duration-300 hover:shadow-md ${
                    isUploaded
                      ? "border-emerald-200 dark:border-emerald-800/30 bg-emerald-50/30 dark:bg-emerald-900/5"
                      : isRequired
                      ? "border-gray-200 dark:border-white/8 bg-white dark:bg-white/3 hover:border-[#6c63ff]/30"
                      : "border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/3"
                  }`}
                >
                  {/* Status indicator */}
                  <div className="absolute -top-1 -right-1">
                    {isUploaded ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500 text-white shadow-lg shadow-emerald-500/25">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                        Done
                      </span>
                    ) : isRequired ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500 text-white shadow-lg shadow-amber-500/25">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={2} />
                          <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth={2} />
                          <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth={2} />
                        </svg>
                        Required
                      </span>
                    ) : null}
                  </div>

                  <div className="p-4">
                    <DocumentUploadItem
                      enrollmentId={enrollmentId}
                      docType={doc.docType}
                      label={doc.docType}
                      isRequired={isRequired}
                      isReusable={doc.isReusable}
                      reusedFrom={doc.reusedFrom}
                      existingPublicId={existing?.cloudinary_public_id ?? null}
                      verificationStatus={existing?.verification_status ?? null}
                      rejectionNote={existing?.rejection_note ?? null}
                      academicYearName={openYearName}
                      branchId={branchId}
                      studentId={studentId}
                      onUploadComplete={handleUploadComplete}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Inline error */}
        {error && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50/80 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20">
            <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Submit button */}
        <div className="pt-4 border-t border-gray-100 dark:border-white/5">
          <Button
            className="w-full bg-linear-to-r from-[#6c63ff] to-[#7c73ff] hover:from-[#5a52e0] hover:to-[#6c63ff] text-white rounded-xl py-3 font-semibold transition-all duration-300 shadow-lg shadow-[#6c63ff]/25 hover:shadow-[#6c63ff]/40 disabled:opacity-50 disabled:hover:shadow-lg"
            onClick={handleFinalSubmit}
            disabled={
              submitting ||
              (requiredDocs.length > 0 && !allRequiredUploaded)
            }
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-3">
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                </svg>
                Submitting application...
              </span>
            ) : allRequiredUploaded || requiredDocs.length === 0 ? (
              <span className="flex items-center justify-center gap-2">
                Submit Application
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={2} />
                  <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth={2} />
                  <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth={2} />
                </svg>
                {requiredNotUploaded.length} document{requiredNotUploaded.length === 1 ? "" : "s"} remaining
              </span>
            )}
          </Button>
          
          {requiredNotUploaded.length > 0 && (
            <p className="mt-3 text-xs text-center text-gray-400 dark:text-gray-500">
              Please upload all required documents to complete your application
            </p>
          )}
        </div>
      </div>
    )
  }

  return null
}