// components/admin/payment-reconciliation-client.tsx
// Redesigned payment reconciliation client with modern UI

"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"

interface AcademicYear {
  id: string
  name: string
  status: string
}

interface PaymentSummary {
  totalPayments: number
  totalConfirmed: number
  totalPending: number
  totalFailed: number
  totalExpired: number
  totalAmount: number
  chapaPayments: number
  manualPayments: number
  discrepancies: number
}

interface PaymentRow {
  id: string
  txRef: string
  amount: number
  currency: string
  status: string
  source: string
  confirmedAt: string | null
  createdAt: string
  overrideReason: string | null
  enrollmentId: string
  enrollmentStatus: string
  studentStuId: string
  studentFullName: string
  branchName: string
  chapaStatus: string | null
  discrepancy: string | null
}

interface BranchSummary {
  branchId: string
  branchName: string
  totalConfirmed: number
  totalAmount: number
  chapaAmount: number
  manualAmount: number
  pendingCount: number
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  CONFIRMED: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200/50 dark:border-emerald-800/30",
    dot: "bg-emerald-500"
  },
  PENDING: {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200/50 dark:border-amber-800/30",
    dot: "bg-amber-500"
  },
  FAILED: {
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
}

export default function PaymentReconciliationClient({
  years,
}: {
  years: AcademicYear[]
}) {
  const [selectedYearId, setSelectedYearId] = useState(years[0]?.id ?? "")
  const [activeTab, setActiveTab] = useState<"summary" | "transactions">("summary")
  const [summary, setSummary] = useState<PaymentSummary | null>(null)
  const [branchSummaries, setBranchSummaries] = useState<BranchSummary[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSummary = useCallback(async () => {
    if (!selectedYearId) return
    setLoading(true)
    setError(null)
    try {
      const [reconResponse, branchResponse] = await Promise.all([
        fetch(`/api/master/payments/reconcile?academicYearId=${selectedYearId}`),
        fetch(`/api/master/payments/summary?academicYearId=${selectedYearId}`),
      ])

      const reconData = await reconResponse.json()
      const branchData = await branchResponse.json()

      if (!reconResponse.ok) {
        setError(reconData.error ?? "Could not load payment data")
        return
      }

      setSummary(reconData.summary)
      setPayments(reconData.payments)
      setBranchSummaries(branchData.branchSummaries ?? [])
    } catch {
      setError("Could not load payment data")
    } finally {
      setLoading(false)
    }
  }, [selectedYearId])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  async function handleVerifyWithChapa() {
    if (!selectedYearId) return
    setVerifying(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/master/payments/reconcile?academicYearId=${selectedYearId}&verifyWithChapa=true`
      )
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? "Verification failed")
        return
      }
      setSummary(data.summary)
      setPayments(data.payments)
    } catch {
      setError("Verification failed")
    } finally {
      setVerifying(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full border-4 border-[#6c63ff]/20 border-t-[#6c63ff] animate-spin" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading payment data...</p>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="p-4 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-gray-100/50 dark:border-white/5">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="h-4 w-32 rounded bg-gray-200 dark:bg-white/10" />
                      <div className="h-3 w-48 rounded bg-gray-200 dark:bg-white/10" />
                    </div>
                    <div className="h-8 w-20 rounded bg-gray-200 dark:bg-white/10" />
                  </div>
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
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Academic Year:</label>
          <select
            value={selectedYearId}
            onChange={(e) => setSelectedYearId(e.target.value)}
            className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-transparent px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
          >
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name} ({y.status})
              </option>
            ))}
          </select>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleVerifyWithChapa}
          disabled={verifying || loading}
          className="rounded-lg border-[#6c63ff]/30 text-[#6c63ff] hover:bg-[#6c63ff]/10 hover:border-[#6c63ff] transition-all duration-200"
        >
          {verifying ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
              </svg>
              Verifying...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Verify with Chapa API
            </span>
          )}
        </Button>
      </div>

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

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200/50 dark:border-white/10">
        {(["summary", "transactions"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-all duration-200 ${
              activeTab === tab
                ? "border-b-2 border-[#6c63ff] text-[#6c63ff] dark:text-[#9d97ff]"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {tab}
            {tab === "transactions" && payments.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400">
                {payments.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "summary" ? (
        <div className="space-y-6">
          {/* Overall summary cards */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="rounded-xl bg-linear-to-br from-[#6c63ff]/10 to-[#8b83ff]/10 border border-[#6c63ff]/20 p-4 text-center">
                <p className="text-2xl font-bold text-[#6c63ff] dark:text-[#9d97ff]">
                  {summary.totalAmount.toLocaleString()}
                </p>
                <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Total Amount (ETB)</p>
              </div>
              <div className="rounded-xl bg-linear-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-200/50 dark:border-emerald-800/30 p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {summary.totalConfirmed}
                </p>
                <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Confirmed</p>
              </div>
              <div className="rounded-xl bg-linear-to-br from-amber-500/10 to-amber-600/10 border border-amber-200/50 dark:border-amber-800/30 p-4 text-center">
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {summary.totalPending}
                </p>
                <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Pending</p>
              </div>
              <div className="rounded-xl bg-linear-to-br from-blue-500/10 to-blue-600/10 border border-blue-200/50 dark:border-blue-800/30 p-4 text-center">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {summary.chapaPayments}
                </p>
                <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Via Chapa</p>
              </div>
              <div className="rounded-xl bg-linear-to-br from-purple-500/10 to-purple-600/10 border border-purple-200/50 dark:border-purple-800/30 p-4 text-center">
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {summary.manualPayments}
                </p>
                <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Manual Override</p>
              </div>
              {summary.discrepancies > 0 ? (
                <div className="rounded-xl bg-linear-to-br from-red-500/10 to-red-600/10 border border-red-200/50 dark:border-red-800/30 p-4 text-center">
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {summary.discrepancies}
                  </p>
                  <p className="text-[10px] font-medium text-red-500 dark:text-red-400">Discrepancies</p>
                </div>
              ) : (
                <div className="rounded-xl bg-linear-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-200/50 dark:border-emerald-800/30 p-4 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">0</span>
                  </div>
                  <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Discrepancies</p>
                </div>
              )}
            </div>
          )}

          {/* Branch breakdown */}
          {branchSummaries.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">By Branch</h3>
                <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {branchSummaries.map((b) => {
                  const confirmedPercent = b.totalConfirmed > 0 
                    ? Math.round((b.totalConfirmed / (b.totalConfirmed + b.pendingCount)) * 100)
                    : 0
                  
                  return (
                    <div
                      key={b.branchId}
                      className="rounded-xl border border-gray-100/50 dark:border-white/8 bg-white/50 dark:bg-white/3 p-4 transition-all duration-200 hover:shadow-md"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {b.branchName}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                            <span>{b.totalConfirmed} confirmed</span>
                            <span className="text-gray-300 dark:text-white/20">·</span>
                            <span>{b.pendingCount} pending</span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-blue-500" />
                              Chapa: {b.chapaAmount.toLocaleString()}
                            </span>
                            <span className="text-gray-300 dark:text-white/20">|</span>
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-purple-500" />
                              Manual: {b.manualAmount.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900 dark:text-white">
                            {b.totalAmount.toLocaleString()} ETB
                          </p>
                          <div className="w-16 h-1.5 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden mt-1 ml-auto">
                            <div 
                              className="h-full rounded-full bg-linear-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                              style={{ width: `${confirmedPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Transactions tab */
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {payments.length} transactions
              {payments.some((p) => p.discrepancy) && (
                <span className="ml-2 text-red-500 font-medium">
                  — {payments.filter((p) => p.discrepancy).length} discrepancies
                </span>
              )}
            </p>
          </div>

          {payments.length === 0 ? (
            <div className="flex flex-col items-center py-12 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
              <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <p className="text-sm text-gray-500 dark:text-gray-400">No transactions found</p>
            </div>
          ) : (
            payments.map((p) => {
              const statusColor = STATUS_COLORS[p.status] || STATUS_COLORS.PENDING
              const hasDiscrepancy = p.discrepancy !== null
              const isChapa = p.source === "CHAPA"

              return (
                <div
                  key={p.id}
                  className={`rounded-xl border p-4 transition-all duration-200 hover:shadow-md ${
                    hasDiscrepancy
                      ? "border-red-200/50 dark:border-red-800/30 bg-red-50/30 dark:bg-red-900/5"
                      : "border-gray-100/50 dark:border-white/8 bg-white/50 dark:bg-white/3"
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {p.studentFullName}
                        </p>
                        <span className="text-xs font-mono text-gray-400 dark:text-gray-500">
                          STU {p.studentStuId}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        <span>{p.branchName}</span>
                        <span className="text-gray-300 dark:text-white/20">·</span>
                        <span className="font-mono text-gray-400 dark:text-gray-500">{p.txRef}</span>
                      </div>
                      {p.overrideReason && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 italic mt-1">
                          Override: {p.overrideReason}
                        </p>
                      )}
                      {hasDiscrepancy && (
                        <div className="flex items-start gap-1.5 mt-1">
                          <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-xs text-red-600 dark:text-red-400 font-medium">{p.discrepancy}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-start md:items-end gap-1 shrink-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {p.amount.toLocaleString()} {p.currency}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium ${statusColor.bg} ${statusColor.text} ${statusColor.border} border`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusColor.dot}`} />
                          {p.status}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          isChapa
                            ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/30"
                            : "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/30"
                        }`}>
                          {isChapa ? "Chapa" : "Manual"}
                        </span>
                      </div>
                      {p.confirmedAt && (
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">
                          Confirmed: {new Date(p.confirmedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}