// components/admin/application-review-client.tsx
// Redesigned full application review UI

"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import DocumentViewer from "@/components/shared/document-viewer"
import TransferInitiateForm from "./transfer-initiate-form"

interface RejectionReason {
  id: string
  doc_type: string
  reason_text: string
}

interface Document {
  id: string
  doc_type: string
  verification_status: string
  rejection_note: string | null
  is_reused_from_enrollment_id: string | null
  uploaded_at: string
  rejectionReason: { id: string; reason_text: string } | null
}

interface EnrollmentHistory {
  id: string
  status: string
  academicResult: string
  submittedAt: string
  academicYearName: string
  branchName: string
  gradeName: string
}

interface ReviewData {
  enrollment: {
    id: string
    status: string
    student_category: string
    academic_result: string
    submitted_at: string
    guardian_id: string
    student: {
      id: string
      stu_id: string
      full_name: string
      date_of_birth: string
      gender: string
    }
    branch: { id: string; name: string }
    grade: { id: string; name: string }
    stream: { id: string; name: string } | null
    academicYear: { id: string; name: string }
  }
  guardianProfile: {
    full_name: string
    phone: string
    residential_address: string
    is_complete: boolean
  } | null
  documents: Document[]
  rejectionReasons: RejectionReason[]
  enrollmentHistory: EnrollmentHistory[]
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

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
  PENDING: {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200/50 dark:border-amber-800/30",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={2} />
        <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth={2} />
        <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth={2} />
      </svg>
    )
  },
  VERIFIED: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200/50 dark:border-emerald-800/30",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    )
  },
  REJECTED: {
    bg: "bg-red-50 dark:bg-red-900/20",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200/50 dark:border-red-800/30",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
    )
  },
}

interface ApplicationReviewClientProps {
  enrollmentId: string
  adminRole: string
}

export default function ApplicationReviewClient({
  enrollmentId,
  adminRole,
}: ApplicationReviewClientProps) {
  const router = useRouter()
  const [data, setData] = useState<ReviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null)
  const [selectedReasonId, setSelectedReasonId] = useState("")
  const [rejectionNote, setRejectionNote] = useState("")
  const [docActionLoading, setDocActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [lockWarning, setLockWarning] = useState<string | null>(null)
  const [lockExpiry, setLockExpiry] = useState<string | null>(null)
  const lockRenewRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/admin/branch/enrollments/${enrollmentId}`
      )
      const json = await response.json()

      if (!response.ok) {
        setError(json.error ?? "Could not load application")
        return
      }

      setData(json)
    } catch {
      setError("Could not load application")
    } finally {
      setLoading(false)
    }
  }, [enrollmentId])

  const acquireLock = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/admin/enrollments/${enrollmentId}/lock`,
        { method: "POST" }
      )
      const json = await response.json()

      if (json.warned) {
        setLockWarning(json.message)
      } else if (json.acquired) {
        setLockWarning(null)
        setLockExpiry(json.expiresAt)
      }
    } catch {
      // Lock acquisition failure is non-fatal
    }
  }, [enrollmentId])

  const releaseLock = useCallback(async () => {
    try {
      await fetch(`/api/admin/enrollments/${enrollmentId}/lock`, {
        method: "DELETE",
      })
    } catch {
      // Non-fatal
    }
  }, [enrollmentId])

  useEffect(() => {
    fetchData()
    acquireLock()

    lockRenewRef.current = setInterval(acquireLock, 10 * 60 * 1000)

    return () => {
      if (lockRenewRef.current) clearInterval(lockRenewRef.current)
      releaseLock()
    }
  }, [fetchData, acquireLock, releaseLock])

  async function handleDocumentAction(
    documentId: string,
    action: "VERIFY" | "REJECT"
  ) {
    if (action === "REJECT" && !selectedReasonId) {
      setActionError("Select a rejection reason")
      return
    }

    setDocActionLoading(documentId)
    setActionError(null)

    try {
      const response = await fetch(
        `/api/admin/enrollments/${enrollmentId}/documents/${documentId}/verify`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            action === "VERIFY"
              ? { action: "VERIFY" }
              : {
                  action: "REJECT",
                  rejectionReasonId: selectedReasonId,
                  rejectionNote: rejectionNote.trim() || undefined,
                }
          ),
        }
      )

      const json = await response.json()

      if (!response.ok) {
        setActionError(json.error ?? "Action failed")
        return
      }

      setRejectingDocId(null)
      setSelectedReasonId("")
      setRejectionNote("")
      await fetchData()
    } catch {
      setActionError("Action failed. Please try again.")
    } finally {
      setDocActionLoading(null)
    }
  }

  async function handleEnrollmentAction(action: "approve" | "reject") {
    setActionError(null)
    setActionLoading(true)

    try {
      const endpoint =
        action === "approve"
          ? `/api/admin/branch/enrollments/${enrollmentId}/approve`
          : `/api/admin/branch/enrollments/${enrollmentId}/reject`

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      const json = await response.json()

      if (!response.ok) {
        setActionError(json.error ?? "Action failed")
        return
      }

      router.push(
        adminRole === "MASTER_ADMIN"
          ? "/dashboard/master"
          : "/dashboard/branch"
      )
      router.refresh()
    } catch {
      setActionError("Action failed. Please try again.")
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-[#6c63ff]/20 border-t-[#6c63ff] animate-spin" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Loading application details...
            </p>
          </div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-gray-100 dark:border-white/5 p-4">
              <div className="space-y-2">
                <div className="h-5 w-40 rounded bg-gray-200 dark:bg-white/10" />
                <div className="h-3 w-32 rounded bg-gray-200 dark:bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-xl bg-linear-to-br from-red-50/80 to-red-50/30 dark:from-red-900/20 dark:to-red-900/5 border border-red-200/50 dark:border-red-800/30 p-6">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl" />
          <div className="relative flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-red-700 dark:text-red-400">Error Loading Application</h3>
              <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">{error ?? "Application not found"}</p>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="rounded-xl border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-[#6c63ff]/40 hover:text-[#6c63ff]"
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Go Back
          </span>
        </Button>
      </div>
    )
  }

  const { enrollment, guardianProfile, documents, rejectionReasons, enrollmentHistory } = data

  const allVerified = documents.length > 0 && documents.every((d) => d.verification_status === "VERIFIED")
  const hasRejections = documents.some((d) => d.verification_status === "REJECTED")
  const isPendingReview = enrollment.status === "PENDING_REVIEW"

  return (
    <div className="space-y-6">
      {/* Lock warnings */}
      {lockWarning && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50/80 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30">
          <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">⚠️ Concurrent Review Warning</p>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-0.5">{lockWarning}</p>
          </div>
        </div>
      )}

      {lockExpiry && !lockWarning && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-gray-100/50 dark:border-white/5">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Review lock held — expires {new Date(lockExpiry).toLocaleTimeString()}
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-[#6c63ff]/20 to-[#8b83ff]/20 flex items-center justify-center border border-[#6c63ff]/20">
            <span className="text-2xl font-bold text-[#6c63ff]">
              {enrollment.student.full_name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              {enrollment.student.full_name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-xs font-mono text-gray-500 dark:text-gray-400">STU {enrollment.student.stu_id}</span>
              <span className="text-gray-300 dark:text-white/20 text-xs">·</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{enrollment.academicYear.name}</span>
              <span className="text-gray-300 dark:text-white/20 text-xs">·</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{enrollment.grade.name}</span>
              {enrollment.stream && (
                <>
                  <span className="text-gray-300 dark:text-white/20 text-xs">·</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{enrollment.stream.name}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="rounded-xl border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-[#6c63ff]/40 hover:text-[#6c63ff]"
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </span>
        </Button>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
          enrollment.status === "PENDING_REVIEW"
            ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/30"
            : enrollment.status === "ENROLLED"
            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30"
            : enrollment.status === "REJECTED"
            ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200/50 dark:border-red-800/30"
            : "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 border border-gray-200/50 dark:border-white/10"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            enrollment.status === "PENDING_REVIEW" ? "bg-amber-500 animate-pulse" :
            enrollment.status === "ENROLLED" ? "bg-emerald-500" :
            enrollment.status === "REJECTED" ? "bg-red-500" :
            "bg-gray-500"
          }`} />
          {enrollment.status}
        </span>
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium ${
          enrollment.academic_result === "PASSED"
            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
            : enrollment.academic_result === "FAILED"
            ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
            : "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400"
        }`}>
          Result: {enrollment.academic_result}
        </span>
      </div>

      {/* Student Info Card */}
      <div className="rounded-xl bg-white/50 dark:bg-white/3 border border-gray-100/50 dark:border-white/8 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Student Details</h3>
          <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-0.5">
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500">Full Name</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{enrollment.student.full_name}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500">Date of Birth</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {new Date(enrollment.student.date_of_birth).toLocaleDateString()}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500">Gender</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 capitalize">{enrollment.student.gender.toLowerCase()}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500">Category</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{enrollment.student_category}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500">Academic Result</p>
            <p className={`text-sm font-semibold ${
              enrollment.academic_result === "PASSED"
                ? "text-emerald-600 dark:text-emerald-400"
                : enrollment.academic_result === "FAILED"
                ? "text-red-600 dark:text-red-400"
                : "text-gray-500 dark:text-gray-400"
            }`}>
              {enrollment.academic_result}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500">Submitted</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {new Date(enrollment.submitted_at).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Guardian Info */}
      {guardianProfile && (
        <div className="rounded-xl bg-white/50 dark:bg-white/3 border border-gray-100/50 dark:border-white/8 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Guardian Details</h3>
            <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-0.5">
              <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500">Name</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{guardianProfile.full_name}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500">Phone</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{guardianProfile.phone}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500">Address</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{guardianProfile.residential_address}</p>
            </div>
          </div>
        </div>
      )}

      {/* Enrollment History */}
      {enrollmentHistory.length > 0 && (
        <div className="rounded-xl bg-white/50 dark:bg-white/3 border border-gray-100/50 dark:border-white/8 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Enrollment History</h3>
            <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
          </div>
          <div className="space-y-2">
            {enrollmentHistory.map((h) => (
              <div key={h.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50/50 dark:bg-white/5">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-white">{h.academicYearName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{h.branchName} · {h.gradeName}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{h.status}</span>
                  {h.academicResult !== "PENDING" && (
                    <span className={`text-xs font-medium ${
                      h.academicResult === "PASSED"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}>
                      {h.academicResult}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documents */}
      <div className="rounded-xl bg-white/50 dark:bg-white/3 border border-gray-100/50 dark:border-white/8 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Documents</h3>
          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#6c63ff]/10 text-[#6c63ff] border border-[#6c63ff]/20">
            {documents.length}
          </span>
          <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
        </div>

        {documents.length === 0 ? (
          <div className="flex flex-col items-center py-8 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl">
            <svg className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm text-gray-500 dark:text-gray-400">No documents uploaded</p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => {
              const docConfig = DOC_TYPE_LABELS[doc.doc_type] || { label: doc.doc_type, icon: "📄" }
              const statusConfig = STATUS_CONFIG[doc.verification_status] || STATUS_CONFIG.PENDING
              const isRejecting = rejectingDocId === doc.id
              const relevantReasons = rejectionReasons.filter((r) => r.doc_type === doc.doc_type)

              return (
                <div
                  key={doc.id}
                  className={`rounded-xl border p-4 transition-all duration-200 ${
                    doc.verification_status === "REJECTED"
                      ? `${statusConfig.bg} ${statusConfig.border} border`
                      : doc.verification_status === "VERIFIED"
                      ? `${statusConfig.bg} ${statusConfig.border} border`
                      : "border-gray-100/50 dark:border-white/8 bg-white dark:bg-white/3"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        doc.verification_status === "VERIFIED"
                          ? "bg-emerald-500/10 border border-emerald-200/50 dark:border-emerald-800/30"
                          : doc.verification_status === "REJECTED"
                          ? "bg-red-500/10 border border-red-200/50 dark:border-red-800/30"
                          : "bg-gray-100 dark:bg-white/5 border border-gray-200/50 dark:border-white/10"
                      }`}>
                        <span className="text-lg">{docConfig.icon}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-white">
                          {docConfig.label}
                        </p>
                        {doc.is_reused_from_enrollment_id && (
                          <p className="text-xs text-blue-600 dark:text-blue-400">Reused from previous enrollment</p>
                        )}
                        {doc.verification_status === "REJECTED" && doc.rejectionReason && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                            {doc.rejectionReason.reason_text}
                            {doc.rejection_note && ` — ${doc.rejection_note}`}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                      {statusConfig.icon}
                      {doc.verification_status}
                    </span>
                  </div>

                  <div className="mt-3">
                    <DocumentViewer documentId={doc.id} docType={doc.doc_type} mode="preview" />
                  </div>

                  {/* Actions for pending review */}
                  {isPendingReview && doc.verification_status !== "VERIFIED" && (
                    <div className="mt-3 pt-3 border-t border-gray-100/50 dark:border-white/5">
                      {isRejecting ? (
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-600 dark:text-gray-400">Rejection Reason</Label>
                            <select
                              value={selectedReasonId}
                              onChange={(e) => setSelectedReasonId(e.target.value)}
                              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-transparent px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
                            >
                              <option value="">Select a reason...</option>
                              {relevantReasons.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.reason_text}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-600 dark:text-gray-400">Additional Note (optional)</Label>
                            <Textarea
                              value={rejectionNote}
                              onChange={(e) => setRejectionNote(e.target.value)}
                              placeholder="Add a specific note for this document..."
                              rows={2}
                              maxLength={500}
                              className="rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20 resize-none"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDocumentAction(doc.id, "REJECT")}
                              disabled={docActionLoading === doc.id || !selectedReasonId}
                              className="rounded-lg"
                            >
                              {docActionLoading === doc.id ? "Rejecting..." : "Confirm Reject"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setRejectingDocId(null)
                                setSelectedReasonId("")
                                setRejectionNote("")
                              }}
                              disabled={docActionLoading === doc.id}
                              className="rounded-lg"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white"
                            onClick={() => handleDocumentAction(doc.id, "VERIFY")}
                            disabled={docActionLoading === doc.id}
                          >
                            {docActionLoading === doc.id ? (
                              <span className="flex items-center gap-2">
                                <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                                </svg>
                                Verifying...
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                                Verify
                              </span>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setRejectingDocId(doc.id)
                              setSelectedReasonId("")
                              setRejectionNote("")
                            }}
                            disabled={docActionLoading === doc.id}
                            className="rounded-lg border-red-200 dark:border-red-800/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <span className="flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Reject
                            </span>
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {isPendingReview && doc.verification_status === "VERIFIED" && (
                    <div className="mt-3 pt-3 border-t border-gray-100/50 dark:border-white/5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDocumentAction(doc.id, "VERIFY")}
                        disabled={docActionLoading === doc.id}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                      >
                        ✓ Verified — click to re-verify
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Action errors */}
      {actionError && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50/80 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20">
          <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-600 dark:text-red-400">{actionError}</p>
        </div>
      )}

      {/* Enrollment Decision */}
      {isPendingReview && (
        <div className="rounded-xl bg-white/50 dark:bg-white/3 border border-gray-100/50 dark:border-white/8 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Enrollment Decision</h3>
            <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
          </div>

          {!allVerified && !hasRejections && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/20">
              <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Verify or reject each document before making an enrollment decision.
              </p>
            </div>
          )}

          {hasRejections && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50/50 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20">
              <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-red-600 dark:text-red-400">
                One or more documents are rejected. You can reject the enrollment now. The guardian will need to resubmit.
              </p>
            </div>
          )}

          {allVerified && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200/50 dark:border-emerald-800/20">
              <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                All documents verified. You can now approve this enrollment.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              className="flex-1 bg-linear-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl py-2.5 font-semibold shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 disabled:opacity-50"
              disabled={!allVerified || actionLoading}
              onClick={() => handleEnrollmentAction("approve")}
            >
              {actionLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                  </svg>
                  Processing...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Approve Enrollment
                </span>
              )}
            </Button>
            <Button
              variant="destructive"
              className="flex-1 rounded-xl py-2.5 font-semibold disabled:opacity-50"
              disabled={!hasRejections || actionLoading}
              onClick={() => handleEnrollmentAction("reject")}
            >
              {actionLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                  </svg>
                  Processing...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Reject Enrollment
                </span>
              )}
            </Button>
          </div>
        </div>
      )}

      {!isPendingReview && (
        <div className="rounded-xl bg-gray-50/50 dark:bg-white/5 border border-gray-200/50 dark:border-white/10 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This enrollment is in <span className="font-semibold text-gray-700 dark:text-gray-300">{enrollment.status}</span> status — no further document actions required.
          </p>
        </div>
      )}

      {/* Transfer Initiation */}
      {(enrollment.status === "PENDING_REVIEW" || enrollment.status === "REJECTED") && (
        <div className="rounded-xl bg-white/50 dark:bg-white/3 border border-gray-100/50 dark:border-white/8 p-5">
          <TransferInitiateForm
            enrollmentId={enrollment.id}
            currentBranchId={enrollment.branch.id}
            onSuccess={() => {
              router.push(
                adminRole === "MASTER_ADMIN" ? "/dashboard/master" : "/dashboard/branch"
              )
              router.refresh()
            }}
          />
        </div>
      )}
    </div>
  )
}