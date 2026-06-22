// components/admin/billing-dashboard.tsx
// Redesigned billing dashboard UI with modern styling

"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"

interface BillingCounter {
  total_successful_enrollments: number
  last_updated_at: string
}

interface AcademicYear {
  id: string
  name: string
  status: string
  start_year: number
  platform_billing_counter: BillingCounter[]
}

interface BranchCount {
  branchId: string
  branchName: string
  count: number
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  OPEN: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200/50 dark:border-emerald-800/30",
    dot: "bg-emerald-500"
  },
  CLOSED: {
    bg: "bg-gray-50 dark:bg-white/5",
    text: "text-gray-600 dark:text-gray-400",
    border: "border-gray-200/50 dark:border-white/10",
    dot: "bg-gray-400"
  },
  CONFIGURATION: {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200/50 dark:border-amber-800/30",
    dot: "bg-amber-500"
  },
  ARCHIVED: {
    bg: "bg-gray-50 dark:bg-white/5 opacity-60",
    text: "text-gray-500 dark:text-gray-500",
    border: "border-gray-200/50 dark:border-white/10",
    dot: "bg-gray-400"
  },
}

export default function BillingDashboard() {
  const [years, setYears] = useState<AcademicYear[]>([])
  const [breakdownByYear, setBreakdownByYear] = useState<Record<string, BranchCount[]>>({})
  const [invoiceRate, setInvoiceRate] = useState(100)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchBilling = useCallback(async () => {
    try {
      const response = await fetch("/api/master/billing")
      if (!response.ok) {
        setError("Could not load billing data")
        return
      }
      const data = await response.json()
      setYears(data.years ?? [])
      setBreakdownByYear(data.breakdownByYear ?? {})
      setInvoiceRate(data.invoiceRate ?? 100)
    } catch {
      setError("Could not load billing data")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchBilling()
  }, [fetchBilling])

  async function handleRefresh() {
    setRefreshing(true)
    await fetchBilling()
  }

  function getLastUpdated(year: AcademicYear): string | null {
    const counters = year.platform_billing_counter
    if (!counters || counters.length === 0) return null
    return counters[0]?.last_updated_at ?? null
  }

  // Calculate total across all years
  const totalAllYears = years.reduce((sum, year) => {
    const breakdown = breakdownByYear[year.id] ?? []
    return sum + breakdown.reduce((s, b) => s + b.count, 0)
  }, 0)

  const totalInvoiceAllYears = totalAllYears * invoiceRate

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full border-4 border-[#6c63ff]/20 border-t-[#6c63ff] animate-spin" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading billing data...</p>
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
                      <div className="h-3 w-24 rounded bg-gray-200 dark:bg-white/10" />
                    </div>
                    <div className="h-8 w-16 rounded bg-gray-200 dark:bg-white/10" />
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

  if (error) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50/80 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20">
        <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-sm font-medium text-red-700 dark:text-red-400">Error Loading Data</p>
          <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Global summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl bg-linear-to-br from-[#6c63ff]/10 to-[#8b83ff]/10 border border-[#6c63ff]/20 p-5 text-center">
          <p className="text-3xl font-bold text-[#6c63ff] dark:text-[#9d97ff]">{years.length}</p>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Academic Years</p>
        </div>
        <div className="rounded-xl bg-linear-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-200/50 dark:border-emerald-800/30 p-5 text-center">
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{totalAllYears.toLocaleString()}</p>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Total Enrollments</p>
        </div>
        <div className="rounded-xl bg-linear-to-br from-amber-500/10 to-amber-600/10 border border-amber-200/50 dark:border-amber-800/30 p-5 text-center">
          <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{totalInvoiceAllYears.toLocaleString()} ETB</p>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Total Invoice Amount</p>
        </div>
      </div>

      {/* Invoice rate notice */}
      <div className="relative overflow-hidden rounded-xl bg-linear-to-br from-blue-50/80 to-blue-50/30 dark:from-blue-900/20 dark:to-blue-900/5 border border-blue-200/50 dark:border-blue-800/30 p-4">
        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl" />
        <div className="relative flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
              Invoice Rate: {invoiceRate} ETB per successful enrollment
            </p>
            <p className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-0.5">
              At the end of the enrollment season, generate a manual invoice using the totals below.
            </p>
          </div>
        </div>
      </div>

      {years.length === 0 ? (
        <div className="flex flex-col items-center py-12 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
          <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">No academic years found</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Billing data will appear once enrollments are processed</p>
        </div>
      ) : (
        <div className="space-y-4">
          {years.map((year) => {
            const lastUpdated = getLastUpdated(year)
            const breakdown = breakdownByYear[year.id] ?? []
            const total = breakdown.reduce((sum, b) => sum + b.count, 0)
            const invoiceAmount = total * invoiceRate
            const statusColor = STATUS_COLORS[year.status] || STATUS_COLORS.CLOSED

            return (
              <div
                key={year.id}
                className="rounded-xl border border-gray-100/50 dark:border-white/8 bg-white/50 dark:bg-white/3 p-5 transition-all duration-200 hover:shadow-md"
              >
                {/* Year header */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {year.name}
                      </p>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium ${statusColor.bg} ${statusColor.text} ${statusColor.border} border`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusColor.dot}`} />
                        {year.status}
                      </span>
                    </div>
                    {lastUpdated && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Last updated: {new Date(lastUpdated).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      {total.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">enrolled students</p>
                  </div>
                </div>

                {/* Invoice calculation */}
                <div className="mt-4 p-4 rounded-xl bg-linear-to-br from-[#6c63ff]/5 to-[#8b83ff]/5 border border-[#6c63ff]/20">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Invoice Amount</p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">
                      {total.toLocaleString()} × {invoiceRate} ETB ={' '}
                      <span className="text-lg font-bold text-[#6c63ff] dark:text-[#9d97ff]">
                        {invoiceAmount.toLocaleString()} ETB
                      </span>
                    </p>
                  </div>
                </div>

                {/* Per-branch breakdown */}
                {breakdown.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Per-branch breakdown</p>
                      <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
                    </div>
                    <div className="rounded-xl border border-gray-100/50 dark:border-white/8 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50/80 dark:bg-white/5 border-b border-gray-100/50 dark:border-white/5">
                          <tr>
                            <th className="text-left px-4 py-2.5 text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                              Branch
                            </th>
                            <th className="text-right px-4 py-2.5 text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                              Enrolled
                            </th>
                            <th className="text-right px-4 py-2.5 text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                              Amount (ETB)
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100/50 dark:divide-white/5">
                          {breakdown
                            .sort((a, b) => b.count - a.count)
                            .map((b) => (
                              <tr key={b.branchId} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                                <td className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {b.branchName}
                                </td>
                                <td className="px-4 py-2.5 text-right text-sm text-gray-600 dark:text-gray-400">
                                  {b.count.toLocaleString()}
                                </td>
                                <td className="px-4 py-2.5 text-right text-sm text-gray-600 dark:text-gray-400">
                                  {(b.count * invoiceRate).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          <tr className="bg-[#6c63ff]/5 dark:bg-[#6c63ff]/10 font-semibold">
                            <td className="px-4 py-3 text-sm text-gray-800 dark:text-white">Total</td>
                            <td className="px-4 py-3 text-right text-sm text-gray-800 dark:text-white">
                              {total.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-bold text-[#6c63ff] dark:text-[#9d97ff]">
                              {invoiceAmount.toLocaleString()}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {breakdown.length === 0 && (
                  <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-gray-50/50 dark:bg-white/5 border border-gray-100/50 dark:border-white/5">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-gray-400 dark:text-gray-500">No enrolled students yet for this year</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Refresh button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="rounded-xl border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-[#6c63ff]/40 hover:text-[#6c63ff] dark:hover:text-[#9d97ff] transition-all"
        >
          {refreshing ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
              </svg>
              Refreshing...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Data
            </span>
          )}
        </Button>
      </div>
    </div>
  )
}