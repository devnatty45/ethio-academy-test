// components/admin/payment-claims-queue.tsx
// Redesigned payment claims queue with modern UI

"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface Claim {
  id: string
  amountPaid: number
  paymentDate: string
  paymentMethod: string
  referenceNumber: string | null
  proofDocumentPublicId: string
  notes: string | null
  createdAt: string
  enrollmentId: string
  student: { stu_id: string; full_name: string }
  expectedAmount: number | null
}

function ClaimProofViewer({ claimId }: { claimId: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleView() {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/admin/branch/payment-claims/${claimId}/proof`
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
      className="rounded-lg border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-[#6c63ff]/40 hover:text-[#6c63ff]"
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
          View Proof
        </span>
      )}
    </Button>
  )
}

export default function PaymentClaimsQueue() {
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [actionId, setActionId] = useState<string | null>(null)

  const fetchClaims = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/branch/payment-claims")
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? "Could not load payment claims")
        return
      }
      setClaims(data.claims ?? [])
    } catch {
      setError("Could not load payment claims")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchClaims()
  }, [fetchClaims])

  async function handleApprove(claimId: string) {
    setActionId(claimId)
    setError(null)
    try {
      const response = await fetch(
        `/api/admin/branch/payment-claims/${claimId}/approve`,
        { method: "POST" }
      )
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? "Could not approve claim")
        return
      }
      await fetchClaims()
    } catch {
      setError("Could not approve claim")
    } finally {
      setActionId(null)
    }
  }

  async function handleReject(claimId: string) {
    if (rejectionReason.trim().length < 5) {
      setError("Rejection reason required")
      return
    }
    setActionId(claimId)
    setError(null)
    try {
      const response = await fetch(
        `/api/admin/branch/payment-claims/${claimId}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rejectionReason: rejectionReason.trim() }),
        }
      )
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? "Could not reject claim")
        return
      }
      setRejectingId(null)
      setRejectionReason("")
      await fetchClaims()
    } catch {
      setError("Could not reject claim")
    } finally {
      setActionId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-5 w-40 rounded bg-gray-200 dark:bg-white/10 animate-pulse" />
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
          Manual Payment Claims
        </h3>
        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/30">
          {claims.length}
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

      {claims.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl">
          <svg className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">No pending payment claims</p>
        </div>
      ) : (
        claims.map((c) => {
          const amountMismatch =
            c.expectedAmount !== null &&
            Math.abs(c.expectedAmount - c.amountPaid) > 0.01

          return (
            <div
              key={c.id}
              className="rounded-xl border border-gray-100/50 dark:border-white/8 bg-white/50 dark:bg-white/3 p-4 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {c.student.full_name}
                    </p>
                    <span className="text-xs font-mono text-gray-400 dark:text-gray-500">
                      STU {c.student.stu_id}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
                      c.paymentMethod === "BANK_TRANSFER"
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                        : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                    }`}>
                      {c.paymentMethod === "BANK_TRANSFER" ? "🏦 Bank Transfer" : "💵 Cash"}
                    </span>
                    <span>·</span>
                    <span>Paid {new Date(c.paymentDate).toLocaleDateString()}</span>
                  </div>
                  {c.referenceNumber && (
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Ref: <span className="font-mono">{c.referenceNumber}</span>
                    </p>
                  )}
                  {c.notes && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                      "{c.notes}"
                    </p>
                  )}
                </div>
                <div className="text-left sm:text-right">
                  <p className={`text-sm font-bold ${amountMismatch ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white"}`}>
                    {c.amountPaid.toLocaleString()} ETB
                  </p>
                  {amountMismatch && (
                    <p className="text-xs text-red-500">
                      Expected {c.expectedAmount?.toLocaleString()} ETB
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <ClaimProofViewer claimId={c.id} />

                {rejectingId === c.id ? (
                  <div className="flex-1 min-w-50 space-y-2">
                    <Textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Reason for rejecting this claim"
                      rows={2}
                      className="rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={actionId === c.id}
                        onClick={() => handleReject(c.id)}
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
                      disabled={actionId === c.id}
                      onClick={() => handleApprove(c.id)}
                      className="rounded-lg bg-linear-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white"
                    >
                      {actionId === c.id ? (
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
                      onClick={() => setRejectingId(c.id)}
                      disabled={actionId === c.id}
                      className="rounded-lg border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-red-500/40 hover:text-red-500"
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
            </div>
          )
        })
      )}
    </div>
  )
}