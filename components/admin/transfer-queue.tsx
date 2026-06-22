// components/admin/transfer-queue.tsx
// Redesigned transfer queue with modern UI

"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "../ui/textarea"

interface TransferItem {
  id: string
  reason: string
  createdAt: string
  fromBranchName: string
  enrollmentId: string
  student: { stu_id: string; full_name: string }
  gradeName: string
  availableSeats: number
}

export default function TransferQueue({
  isMasterAdmin,
}: {
  isMasterAdmin: boolean
}) {
  const [transfers, setTransfers] = useState<TransferItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [actionId, setActionId] = useState<string | null>(null)

  const fetchTransfers = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/branch/transfers")
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? "Could not load transfers")
        return
      }
      setTransfers(data.transfers ?? [])
    } catch {
      setError("Could not load transfers")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTransfers()
  }, [fetchTransfers])

  async function handleAccept(transferId: string, forceAccept = false) {
    setActionId(transferId)
    setError(null)
    try {
      const response = await fetch(
        `/api/admin/branch/transfers/${transferId}/accept`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ forceAccept }),
        }
      )
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? "Could not accept transfer")
        return
      }
      await fetchTransfers()
    } catch {
      setError("Could not accept transfer")
    } finally {
      setActionId(null)
    }
  }

  async function handleReject(transferId: string) {
    if (rejectionReason.trim().length < 5) {
      setError("Rejection reason required")
      return
    }
    setActionId(transferId)
    setError(null)
    try {
      const response = await fetch(
        `/api/admin/branch/transfers/${transferId}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rejectionReason: rejectionReason.trim() }),
        }
      )
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? "Could not reject transfer")
        return
      }
      setRejectingId(null)
      setRejectionReason("")
      await fetchTransfers()
    } catch {
      setError("Could not reject transfer")
    } finally {
      setActionId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-5 w-48 rounded bg-gray-200 dark:bg-white/10 animate-pulse" />
          <div className="h-5 w-8 rounded bg-gray-200 dark:bg-white/10 animate-pulse" />
        </div>
        {[1, 2].map((i) => (
          <div key={i} className="animate-pulse rounded-xl border border-gray-100 dark:border-white/5 p-4">
            <div className="space-y-2">
              <div className="h-5 w-40 rounded bg-gray-200 dark:bg-white/10" />
              <div className="h-3 w-32 rounded bg-gray-200 dark:bg-white/10" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Incoming Transfer Requests
        </h3>
        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/30">
          {transfers.length}
        </span>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50/80 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20">
          <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {transfers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl">
          <svg className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">No pending transfer requests</p>
        </div>
      ) : (
        transfers.map((t) => (
          <div key={t.id} className="rounded-xl border border-gray-100/50 dark:border-white/8 bg-white/50 dark:bg-white/3 p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {t.student.full_name}
                  </p>
                  <span className="text-xs font-mono text-gray-400 dark:text-gray-500">
                    STU {t.student.stu_id}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>From {t.fromBranchName}</span>
                  <span className="text-gray-300 dark:text-white/20">·</span>
                  <span>{t.gradeName}</span>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                  "{t.reason}"
                </p>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium shrink-0 ${
                t.availableSeats > 0
                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30"
                  : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200/50 dark:border-red-800/30"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  t.availableSeats > 0 ? "bg-emerald-500" : "bg-red-500"
                }`} />
                {t.availableSeats} seats available
              </span>
            </div>

            {rejectingId === t.id ? (
              <div className="space-y-3">
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Reason for rejecting (e.g. no seats available)"
                  rows={2}
                  className="rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={actionId === t.id}
                    onClick={() => handleReject(t.id)}
                    className="rounded-lg"
                  >
                    Confirm Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setRejectingId(null)
                      setRejectionReason("")
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
                  disabled={actionId === t.id || t.availableSeats === 0}
                  onClick={() => handleAccept(t.id)}
                  className={`rounded-lg ${
                    t.availableSeats > 0
                      ? "bg-linear-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white"
                      : "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                  }`}
                >
                  {actionId === t.id ? (
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
                      Accept
                    </span>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRejectingId(t.id)}
                  disabled={actionId === t.id}
                  className="rounded-lg border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-red-500/40 hover:text-red-500"
                >
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Reject
                  </span>
                </Button>
                {isMasterAdmin && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg border-amber-400 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                    disabled={actionId === t.id}
                    onClick={() => handleAccept(t.id, true)}
                  >
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Force Accept
                    </span>
                  </Button>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}