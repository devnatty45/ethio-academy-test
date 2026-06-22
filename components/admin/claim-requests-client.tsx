// components/admin/claim-requests-client.tsx
// Redesigned claim requests client with modern UI

"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface GuardianProfile {
  full_name: string
  phone: string
}

interface MatchedStudent {
  id: string
  stu_id: string
  full_name: string
  date_of_birth: string
  gender: string
  status: string
}

interface EnrollmentHistoryItem {
  id: string
  status: string
  academicResult: string
  branchName: string
  gradeName: string
  yearName: string
}

interface ExistingLink {
  id: string
  link_type: string
  is_active: boolean
}

interface ClaimRequest {
  id: string
  confidenceScore: number
  submittedDetails: Record<string, unknown>
  status: string
  rejectionReason: string | null
  createdAt: string
  claimedGuardianId: string
  matchedStudentId: string
  guardianProfile: GuardianProfile | null
  matchedStudent: MatchedStudent | null
  enrollmentHistory: EnrollmentHistoryItem[]
  existingLink: ExistingLink | null
}

const CONFIDENCE_COLOR = (score: number): { bg: string; text: string; border: string; dot: string } => {
  if (score >= 90) {
    return {
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
      text: "text-emerald-700 dark:text-emerald-400",
      border: "border-emerald-200/50 dark:border-emerald-800/30",
      dot: "bg-emerald-500"
    }
  }
  if (score >= 60) {
    return {
      bg: "bg-amber-50 dark:bg-amber-900/20",
      text: "text-amber-700 dark:text-amber-400",
      border: "border-amber-200/50 dark:border-amber-800/30",
      dot: "bg-amber-500"
    }
  }
  return {
    bg: "bg-red-50 dark:bg-red-900/20",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200/50 dark:border-red-800/30",
    dot: "bg-red-500"
  }
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  ENROLLED: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200/50 dark:border-emerald-800/30",
    dot: "bg-emerald-500"
  },
  PAYMENT_PENDING: {
    bg: "bg-blue-50 dark:bg-blue-900/20",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200/50 dark:border-blue-800/30",
    dot: "bg-blue-500"
  },
  PENDING_REVIEW: {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200/50 dark:border-amber-800/30",
    dot: "bg-amber-500"
  },
  REJECTED: {
    bg: "bg-red-50 dark:bg-red-900/20",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200/50 dark:border-red-800/30",
    dot: "bg-red-500"
  },
  EXPIRED: {
    bg: "bg-gray-50 dark:bg-white/5",
    text: "text-gray-600 dark:text-gray-400",
    border: "border-gray-200/50 dark:border-white/10",
    dot: "bg-gray-400"
  },
  CANCELLED: {
    bg: "bg-gray-50 dark:bg-white/5",
    text: "text-gray-600 dark:text-gray-400",
    border: "border-gray-200/50 dark:border-white/10",
    dot: "bg-gray-400"
  },
}

export default function ClaimRequestsClient() {
  const [claims, setClaims] = useState<ClaimRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState("PENDING")

  const [actionId, setActionId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [linkType, setLinkType] = useState<"PRIMARY" | "CO_GUARDIAN">("PRIMARY")
  const [actionError, setActionError] = useState<string | null>(null)

  const fetchClaims = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/master/claim-requests?status=${statusFilter}`
      )
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? "Could not load claim requests")
        return
      }
      setClaims(data.claims ?? [])
    } catch {
      setError("Could not load claim requests")
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchClaims()
  }, [fetchClaims])

  async function handleApprove(claimId: string) {
    setActionId(claimId)
    setActionError(null)
    try {
      const response = await fetch(
        `/api/master/claim-requests/${claimId}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ linkType }),
        }
      )
      const data = await response.json()
      if (!response.ok) {
        setActionError(data.error ?? "Approval failed")
        return
      }
      await fetchClaims()
    } catch {
      setActionError("Approval failed")
    } finally {
      setActionId(null)
    }
  }

  async function handleReject(claimId: string) {
    if (rejectionReason.trim().length < 10) {
      setActionError("Rejection reason must be at least 10 characters")
      return
    }
    setActionId(claimId)
    setActionError(null)
    try {
      const response = await fetch(
        `/api/master/claim-requests/${claimId}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rejectionReason: rejectionReason.trim(),
          }),
        }
      )
      const data = await response.json()
      if (!response.ok) {
        setActionError(data.error ?? "Rejection failed")
        return
      }
      setRejectingId(null)
      setRejectionReason("")
      await fetchClaims()
    } catch {
      setActionError("Rejection failed")
    } finally {
      setActionId(null)
    }
  }

  // Calculate stats
  const totalClaims = claims.length
  const pendingCount = claims.filter(c => c.status === "PENDING").length
  const approvedCount = claims.filter(c => c.status === "APPROVED").length
  const rejectedCount = claims.filter(c => c.status === "REJECTED").length

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full border-4 border-[#6c63ff]/20 border-t-[#6c63ff] animate-spin" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading claim requests...</p>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="p-4 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-gray-100/50 dark:border-white/5">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="h-4 w-32 rounded bg-gray-200 dark:bg-white/10" />
                      <div className="h-3 w-48 rounded bg-gray-200 dark:bg-white/10" />
                    </div>
                    <div className="h-6 w-20 rounded bg-gray-200 dark:bg-white/10" />
                  </div>
                  <div className="h-12 rounded bg-gray-200 dark:bg-white/10" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats summary */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl bg-linear-to-br from-[#6c63ff]/10 to-[#8b83ff]/10 border border-[#6c63ff]/20 p-4 text-center">
          <p className="text-2xl font-bold text-[#6c63ff] dark:text-[#9d97ff]">{totalClaims}</p>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Total</p>
        </div>
        <div className="rounded-xl bg-linear-to-br from-amber-500/10 to-amber-600/10 border border-amber-200/50 dark:border-amber-800/30 p-4 text-center">
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{pendingCount}</p>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Pending</p>
        </div>
        <div className="rounded-xl bg-linear-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-200/50 dark:border-emerald-800/30 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{approvedCount}</p>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Approved</p>
        </div>
        <div className="rounded-xl bg-linear-to-br from-red-500/10 to-red-600/10 border border-red-200/50 dark:border-red-800/30 p-4 text-center">
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{rejectedCount}</p>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Rejected</p>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
              statusFilter === s
                ? "bg-[#6c63ff] text-white shadow-lg shadow-[#6c63ff]/25"
                : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Error messages */}
      {error && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50/80 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20 animate-in fade-in slide-in-from-top-2 duration-300">
          <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-red-700 dark:text-red-400">Error</p>
            <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {actionError && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50/80 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20 animate-in fade-in slide-in-from-top-2 duration-300">
          <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-red-700 dark:text-red-400">Action Error</p>
            <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">{actionError}</p>
          </div>
        </div>
      )}

      {claims.length === 0 ? (
        <div className="flex flex-col items-center py-12 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
          <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">No {statusFilter.toLowerCase()} claim requests</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">All caught up! 🎉</p>
        </div>
      ) : (
        <div className="space-y-4">
          {claims.map((c) => {
            const confidenceStyle = CONFIDENCE_COLOR(c.confidenceScore)
            const isPending = c.status === "PENDING"
            const isRejecting = rejectingId === c.id
            const isActioning = actionId === c.id

            return (
              <div
                key={c.id}
                className="rounded-xl border border-gray-100/50 dark:border-white/8 bg-white/50 dark:bg-white/3 p-5 transition-all duration-200 hover:shadow-md"
              >
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-[#6c63ff]/10 flex items-center justify-center text-[#6c63ff] text-sm font-bold">
                          {c.guardianProfile?.full_name?.charAt(0).toUpperCase() || "G"}
                        </div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {c.guardianProfile?.full_name ?? "Unknown Guardian"}
                        </p>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium ${confidenceStyle.bg} ${confidenceStyle.text} ${confidenceStyle.border} border`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${confidenceStyle.dot}`} />
                        {c.confidenceScore.toFixed(0)}% confidence
                      </span>
                      {c.existingLink && (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium ${
                          c.existingLink.is_active
                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/30"
                            : "bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 border border-gray-200/50 dark:border-white/10"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${c.existingLink.is_active ? "bg-blue-500" : "bg-gray-400"}`} />
                          {c.existingLink.is_active ? "Active Link" : "Inactive Link"}
                        </span>
                      )}
                      {!isPending && (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium ${
                          c.status === "APPROVED"
                            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30"
                            : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200/50 dark:border-red-800/30"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${c.status === "APPROVED" ? "bg-emerald-500" : "bg-red-500"}`} />
                          {c.status}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                      <span>📱 {c.guardianProfile?.phone ?? "No phone"}</span>
                      <span className="text-gray-300 dark:text-white/20">·</span>
                      <span>📅 {new Date(c.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Submitted details */}
                {c.submittedDetails && Object.keys(c.submittedDetails).length > 0 && (
                  <div className="mt-4 p-3 rounded-lg bg-gray-50/50 dark:bg-white/5 border border-gray-100/50 dark:border-white/5">
                    <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                      Submitted Details
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      {Object.entries(c.submittedDetails).map(([key, val]) => (
                        <div key={key}>
                          <p className="text-gray-400 dark:text-gray-500 capitalize">
                            {key.replace(/_/g, " ")}
                          </p>
                          <p className="text-gray-700 dark:text-gray-300 font-medium">
                            {String(val)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Matched student */}
                {c.matchedStudent && (
                  <div className="mt-4 p-3 rounded-lg bg-emerald-50/30 dark:bg-emerald-900/5 border border-emerald-200/50 dark:border-emerald-800/30">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                        Matched Student
                      </p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <p className="text-gray-400 dark:text-gray-500">Name</p>
                        <p className="text-gray-700 dark:text-gray-300 font-medium">
                          {c.matchedStudent.full_name}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 dark:text-gray-500">STU ID</p>
                        <p className="text-gray-700 dark:text-gray-300 font-mono">
                          {c.matchedStudent.stu_id}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 dark:text-gray-500">DOB</p>
                        <p className="text-gray-700 dark:text-gray-300">
                          {new Date(c.matchedStudent.date_of_birth).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 dark:text-gray-500">Gender</p>
                        <p className="text-gray-700 dark:text-gray-300 capitalize">
                          {c.matchedStudent.gender.toLowerCase()}
                        </p>
                      </div>
                    </div>

                    {/* Enrollment history */}
                    {c.enrollmentHistory.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-emerald-200/50 dark:border-emerald-800/30">
                        <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                          Enrollment History
                        </p>
                        <div className="space-y-1.5">
                          {c.enrollmentHistory.map((e) => {
                            const statusColor = STATUS_COLORS[e.status] || STATUS_COLORS.PENDING_REVIEW
                            return (
                              <div
                                key={e.id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-lg bg-white/50 dark:bg-white/5 border border-gray-100/50 dark:border-white/5"
                              >
                                <div className="text-xs text-gray-600 dark:text-gray-400">
                                  <span className="font-medium text-gray-700 dark:text-gray-300">{e.yearName}</span>
                                  <span className="text-gray-400 dark:text-gray-500"> · </span>
                                  <span>{e.branchName}</span>
                                  <span className="text-gray-400 dark:text-gray-500"> · </span>
                                  <span>{e.gradeName}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColor.bg} ${statusColor.text} ${statusColor.border} border`}>
                                    <span className={`w-1 h-1 rounded-full ${statusColor.dot}`} />
                                    {e.status}
                                  </span>
                                  {e.academicResult !== "PENDING" && (
                                    <span className={`text-[10px] font-medium ${
                                      e.academicResult === "PASSED"
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : "text-red-600 dark:text-red-400"
                                    }`}>
                                      {e.academicResult}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Rejection reason if rejected */}
                {c.status === "REJECTED" && c.rejectionReason && (
                  <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-red-50/50 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20">
                    <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-xs font-medium text-red-700 dark:text-red-400">Rejection Reason</p>
                      <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">{c.rejectionReason}</p>
                    </div>
                  </div>
                )}

                {/* Action buttons — only for PENDING */}
                {isPending && (
                  <div className="mt-4 pt-4 border-t border-gray-100/50 dark:border-white/5">
                    {isRejecting ? (
                      <div className="space-y-3">
                        <Textarea
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="Reason for rejecting this claim..."
                          rows={2}
                          maxLength={500}
                          className="rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20 resize-none"
                        />
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 text-right">
                          {rejectionReason.length}/500 characters {rejectionReason.length > 0 && rejectionReason.length < 10 && `(${10 - rejectionReason.length} more needed)`}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={isActioning}
                            onClick={() => handleReject(c.id)}
                            className="rounded-lg"
                          >
                            {isActioning ? (
                              <span className="flex items-center gap-2">
                                <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                                </svg>
                                Rejecting...
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Confirm Reject
                              </span>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setRejectingId(null)
                              setRejectionReason("")
                              setActionError(null)
                            }}
                            className="rounded-lg text-gray-500 hover:text-gray-700"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3">
                        {/* Link type selector */}
                        <div className="flex gap-1 bg-gray-100 dark:bg-white/5 p-0.5 rounded-lg">
                          {(["PRIMARY", "CO_GUARDIAN"] as const).map((t) => (
                            <button
                              key={t}
                              onClick={() => setLinkType(t)}
                              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                                linkType === t
                                  ? "bg-[#6c63ff] text-white shadow-sm"
                                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                              }`}
                            >
                              {t === "PRIMARY" ? "Primary" : "Co-Guardian"}
                            </button>
                          ))}
                        </div>

                        <Button
                          size="sm"
                          disabled={isActioning}
                          onClick={() => handleApprove(c.id)}
                          className="rounded-lg bg-linear-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white"
                        >
                          {isActioning ? (
                            <span className="flex items-center gap-2">
                              <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                              </svg>
                              Approving...
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Approve
                            </span>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-lg border-red-200 dark:border-red-800/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => {
                            setRejectingId(c.id)
                            setRejectionReason("")
                            setActionError(null)
                          }}
                          disabled={isActioning}
                        >
                          <span className="flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Reject
                          </span>
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}