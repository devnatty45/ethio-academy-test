// components/admin/recovery-requests-client.tsx
// Redesigned recovery requests client with modern UI

"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface MatchedProfile {
  full_name: string
  phone: string
  residential_address: string
  is_complete: boolean
}

interface RecoveryRequest {
  id: string
  claimedFullName: string
  claimedPhone: string
  claimedStudentName: string
  claimedStudentDob: string
  recoveryReason: string
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW"
  nationalIdFrontPublicId: string
  nationalIdBackPublicId: string
  status: string
  createdAt: string
  newGuardianId: string
  matchedGuardianId: string | null
  matchedGuardianProfile: MatchedProfile | null
  recentActivityCount: number
}

const CONFIDENCE_STYLES: Record<string, { bg: string; text: string; border: string; dot: string; icon: string }> = {
  HIGH: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200/50 dark:border-emerald-800/30",
    dot: "bg-emerald-500",
    icon: "✓"
  },
  MEDIUM: {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200/50 dark:border-amber-800/30",
    dot: "bg-amber-500",
    icon: "!"
  },
  LOW: {
    bg: "bg-red-50 dark:bg-red-900/20",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200/50 dark:border-red-800/30",
    dot: "bg-red-500",
    icon: "✗"
  },
}

function IdPhotoViewer({
  requestId,
  side,
}: {
  requestId: string
  side: "front" | "back"
}) {
  const [loading, setLoading] = useState(false)

  async function handleView() {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/master/recovery-requests/${requestId}/id-photo?side=${side}`
      )
      const data = await response.json()
      if (response.ok) {
        window.open(data.url, "_blank", "noopener,noreferrer")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleView}
      disabled={loading}
      className={`rounded-lg border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-[#6c63ff]/40 hover:text-[#6c63ff] transition-all ${
        loading ? "opacity-70" : ""
      }`}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
          </svg>
          Loading...
        </span>
      ) : (
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          View ID {side === "front" ? "Front" : "Back"}
        </span>
      )}
    </Button>
  )
}

export default function RecoveryRequestsClient() {
  const [requests, setRequests] = useState<RecoveryRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState("PENDING")

  const [actionId, setActionId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [flaggingId, setFlaggingId] = useState<string | null>(null)
  const [actionReason, setActionReason] = useState("")
  const [actionError, setActionError] = useState<string | null>(null)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/master/recovery-requests?status=${statusFilter}`
      )
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? "Could not load requests")
        return
      }
      setRequests(data.requests ?? [])
    } catch {
      setError("Could not load requests")
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  async function handleApprove(requestId: string) {
    setActionId(requestId)
    setActionError(null)
    try {
      const response = await fetch(
        `/api/master/recovery-requests/${requestId}/approve`,
        { method: "POST" }
      )
      const data = await response.json()
      if (!response.ok) {
        setActionError(data.error ?? "Approval failed")
        return
      }
      await fetchRequests()
    } catch {
      setActionError("Approval failed")
    } finally {
      setActionId(null)
    }
  }

  async function handleReject(requestId: string) {
    if (actionReason.trim().length < 10) {
      setActionError("Rejection reason must be at least 10 characters")
      return
    }
    setActionId(requestId)
    setActionError(null)
    try {
      const response = await fetch(
        `/api/master/recovery-requests/${requestId}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rejectionReason: actionReason.trim(),
          }),
        }
      )
      const data = await response.json()
      if (!response.ok) {
        setActionError(data.error ?? "Rejection failed")
        return
      }
      setRejectingId(null)
      setActionReason("")
      await fetchRequests()
    } catch {
      setActionError("Rejection failed")
    } finally {
      setActionId(null)
    }
  }

  async function handleFlagVisit(requestId: string) {
    if (actionReason.trim().length < 10) {
      setActionError("Reason must be at least 10 characters")
      return
    }
    setActionId(requestId)
    setActionError(null)
    try {
      const response = await fetch(
        `/api/master/recovery-requests/${requestId}/flag-visit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: actionReason.trim() }),
        }
      )
      const data = await response.json()
      if (!response.ok) {
        setActionError(data.error ?? "Flag failed")
        return
      }
      setFlaggingId(null)
      setActionReason("")
      await fetchRequests()
    } catch {
      setActionError("Flag failed")
    } finally {
      setActionId(null)
    }
  }

  // Calculate stats
  const totalRequests = requests.length
  const pendingCount = requests.filter(r => r.status === "PENDING").length
  const approvedCount = requests.filter(r => r.status === "APPROVED").length
  const rejectedCount = requests.filter(r => r.status === "REJECTED").length

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full border-4 border-[#6c63ff]/20 border-t-[#6c63ff] animate-spin" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading recovery requests...</p>
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
          <p className="text-2xl font-bold text-[#6c63ff] dark:text-[#9d97ff]">{totalRequests}</p>
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

      {/* Status filter */}
      <div className="flex flex-wrap gap-1.5">
        {(["PENDING", "APPROVED", "REJECTED", "PHYSICAL_VISIT_REQUIRED"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
              statusFilter === s
                ? "bg-[#6c63ff] text-white shadow-lg shadow-[#6c63ff]/25"
                : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10"
            }`}
          >
            {s.replace(/_/g, " ")}
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

      {requests.length === 0 ? (
        <div className="flex flex-col items-center py-12 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
          <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">No {statusFilter.toLowerCase().replace(/_/g, " ")} requests</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">All caught up! 🎉</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => {
            const confidenceStyle = CONFIDENCE_STYLES[r.confidenceLevel]
            const isPending = r.status === "PENDING"
            const isRejecting = rejectingId === r.id
            const isFlagging = flaggingId === r.id
            const isActioning = actionId === r.id

            return (
              <div
                key={r.id}
                className="rounded-xl border border-gray-100/50 dark:border-white/8 bg-white/50 dark:bg-white/3 p-5 transition-all duration-200 hover:shadow-md"
              >
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {r.claimedFullName}
                      </p>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium ${confidenceStyle.bg} ${confidenceStyle.text} ${confidenceStyle.border} border`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${confidenceStyle.dot}`} />
                        {r.confidenceLevel} confidence
                      </span>
                      {r.recentActivityCount > 0 && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/30">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {r.recentActivityCount} recent activity
                        </span>
                      )}
                      {!isPending && (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium ${
                          r.status === "APPROVED"
                            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30"
                            : r.status === "REJECTED"
                            ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200/50 dark:border-red-800/30"
                            : "bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 border border-gray-200/50 dark:border-white/10"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            r.status === "APPROVED" ? "bg-emerald-500" :
                            r.status === "REJECTED" ? "bg-red-500" :
                            "bg-gray-400"
                          }`} />
                          {r.status.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                      <span>📱 {r.claimedPhone}</span>
                      <span className="text-gray-300 dark:text-white/20">·</span>
                      <span>📅 {new Date(r.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Claimed details */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 p-3 rounded-lg bg-gray-50/50 dark:bg-white/5 border border-gray-100/50 dark:border-white/5">
                  <div>
                    <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      Claimed Student
                    </p>
                    <p className="text-sm font-medium text-gray-800 dark:text-white">
                      {r.claimedStudentName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      DOB: {new Date(r.claimedStudentDob).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      Recovery Reason
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      {r.recoveryReason}
                    </p>
                  </div>
                </div>

                {/* Matched guardian profile comparison */}
                {r.matchedGuardianProfile ? (
                  <div className="mt-4 p-3 rounded-lg bg-emerald-50/30 dark:bg-emerald-900/5 border border-emerald-200/50 dark:border-emerald-800/30">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                        Matched Guardian Profile
                      </p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-gray-400 dark:text-gray-500">Name</p>
                        <p className="text-gray-700 dark:text-gray-300 font-medium">
                          {r.matchedGuardianProfile.full_name}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 dark:text-gray-500">Phone</p>
                        <p className="text-gray-700 dark:text-gray-300 font-medium">
                          {r.matchedGuardianProfile.phone}
                        </p>
                      </div>
                      <div className="col-span-2 md:col-span-1">
                        <p className="text-gray-400 dark:text-gray-500">Address</p>
                        <p className="text-gray-700 dark:text-gray-300">
                          {r.matchedGuardianProfile.residential_address}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/20">
                    <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      No matched guardian profile found — this request cannot be approved without a match.
                    </p>
                  </div>
                )}

                {/* ID photos */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <IdPhotoViewer requestId={r.id} side="front" />
                  <IdPhotoViewer requestId={r.id} side="back" />
                </div>

                {/* Action buttons — only for PENDING */}
                {isPending && (
                  <div className="mt-4 pt-4 border-t border-gray-100/50 dark:border-white/5">
                    {isRejecting || isFlagging ? (
                      <div className="space-y-3">
                        <Textarea
                          value={actionReason}
                          onChange={(e) => setActionReason(e.target.value)}
                          placeholder={
                            isRejecting
                              ? "Reason for rejection..."
                              : "Reason a physical visit is required..."
                          }
                          rows={2}
                          maxLength={500}
                          className="rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20 resize-none"
                        />
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 text-right">
                          {actionReason.length}/500 characters {actionReason.length > 0 && actionReason.length < 10 && `(${10 - actionReason.length} more needed)`}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant={isRejecting ? "destructive" : "outline"}
                            disabled={isActioning}
                            onClick={() =>
                              isRejecting ? handleReject(r.id) : handleFlagVisit(r.id)
                            }
                            className="rounded-lg"
                          >
                            {isActioning ? (
                              <span className="flex items-center gap-2">
                                <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                                </svg>
                                Processing...
                              </span>
                            ) : isRejecting ? (
                              <span className="flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Confirm Reject
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                </svg>
                                Confirm Flag Visit
                              </span>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setRejectingId(null)
                              setFlaggingId(null)
                              setActionReason("")
                              setActionError(null)
                            }}
                            className="rounded-lg text-gray-500 hover:text-gray-700"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          disabled={isActioning || !r.matchedGuardianId}
                          onClick={() => handleApprove(r.id)}
                          title={!r.matchedGuardianId ? "Cannot approve without a matched guardian" : undefined}
                          className={`rounded-lg ${
                            r.matchedGuardianId
                              ? "bg-linear-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white"
                              : "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                          }`}
                        >
                          {isActioning ? (
                            <span className="flex items-center gap-2">
                              <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                              </svg>
                              Processing...
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
                            setRejectingId(r.id)
                            setActionReason("")
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
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-lg border-amber-400 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                          onClick={() => {
                            setFlaggingId(r.id)
                            setActionReason("")
                            setActionError(null)
                          }}
                          disabled={isActioning}
                        >
                          <span className="flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                            Request Visit
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