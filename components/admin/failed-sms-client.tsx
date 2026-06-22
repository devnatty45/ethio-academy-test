// components/admin/failed-sms-client.tsx
// Redesigned failed SMS client with modern UI

"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface FailedSms {
  id: string
  recipient_phone: string
  message_body: string
  trigger_event: string
  retry_count: number
  last_attempted_at: string | null
  created_at: string
  related_id: string | null
}

export default function FailedSmsClient() {
  const [records, setRecords] = useState<FailedSms[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [resending, setResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState<string | null>(null)

  const fetchFailed = useCallback(async () => {
    setLoading(true)
    setError(null)
    setResendSuccess(null)
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.set("dateFrom", dateFrom)
      if (dateTo) params.set("dateTo", dateTo)
      const response = await fetch(`/api/master/sms/failed?${params.toString()}`)
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? "Could not load failed SMS")
        return
      }
      setRecords(data.failed ?? [])
      setTotal(data.total ?? 0)
      setSelected(new Set())
    } catch {
      setError("Could not load failed SMS")
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => {
    fetchFailed()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === records.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(records.map((r) => r.id)))
    }
  }

  async function handleResend(ids: string[]) {
    setResending(true)
    setError(null)
    setResendSuccess(null)
    try {
      const response = await fetch("/api/master/sms/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smsIds: ids }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? "Resend failed")
        return
      }
      setResendSuccess(
        `${data.requeued} message${data.requeued === 1 ? "" : "s"} re-queued for delivery`
      )
      setSelected(new Set())
      await fetchFailed()
    } catch {
      setError("Resend failed")
    } finally {
      setResending(false)
    }
  }

  // Calculate stats
  const totalFailed = records.length

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full border-4 border-[#6c63ff]/20 border-t-[#6c63ff] animate-spin" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading failed SMS messages...</p>
          </div>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="p-4 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-gray-100/50 dark:border-white/5">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-32 rounded bg-gray-200 dark:bg-white/10" />
                      <div className="h-4 w-16 rounded bg-gray-200 dark:bg-white/10" />
                    </div>
                    <div className="h-3 w-48 rounded bg-gray-200 dark:bg-white/10" />
                  </div>
                  <div className="h-8 w-20 rounded bg-gray-200 dark:bg-white/10" />
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
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-linear-to-br from-[#6c63ff]/10 to-[#8b83ff]/10 border border-[#6c63ff]/20 p-4 text-center">
          <p className="text-2xl font-bold text-[#6c63ff] dark:text-[#9d97ff]">{totalFailed}</p>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Total Failed</p>
        </div>
        <div className="rounded-xl bg-linear-to-br from-amber-500/10 to-amber-600/10 border border-amber-200/50 dark:border-amber-800/30 p-4 text-center">
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{selected.size}</p>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Selected</p>
        </div>
        <div className="rounded-xl bg-linear-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-200/50 dark:border-emerald-800/30 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {records.filter(r => r.retry_count >= 3).length}
          </p>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Max Attempts</p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-100/50 dark:border-white/8 bg-white/50 dark:bg-white/3 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filters</h3>
          <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 space-y-1.5">
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">From Date</p>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">To Date</p>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
            />
          </div>
          <div className="flex items-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchFailed}
              disabled={loading}
              className="rounded-lg border-[#6c63ff]/30 text-[#6c63ff] hover:bg-[#6c63ff]/10 hover:border-[#6c63ff] transition-all duration-200"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                  </svg>
                  Loading...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Apply
                </span>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFrom("")
                setDateTo("")
                fetchFailed()
              }}
              className="rounded-lg text-gray-500 hover:text-gray-700"
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear
              </span>
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
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

      {resendSuccess && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-900/10 border border-emerald-200/50 dark:border-emerald-800/20 animate-in fade-in slide-in-from-top-2 duration-300">
          <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <div>
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Success</p>
            <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">{resendSuccess}</p>
          </div>
        </div>
      )}

      {/* Bulk actions */}
      {records.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={toggleSelectAll}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-[#6c63ff] dark:hover:text-[#9d97ff] transition-colors font-medium"
          >
            {selected.size === records.length ? "Deselect all" : "Select all"}
          </button>
          <span className="text-xs text-gray-400 dark:text-gray-500">·</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {selected.size} of {total} selected
          </span>
          {selected.size > 0 && (
            <Button
              size="sm"
              onClick={() => handleResend(Array.from(selected))}
              disabled={resending}
              className="ml-auto rounded-lg bg-linear-to-r from-[#6c63ff] to-[#7c73ff] hover:from-[#5a52e0] hover:to-[#6c63ff] text-white shadow-lg shadow-[#6c63ff]/25 hover:shadow-[#6c63ff]/40 transition-all duration-300 disabled:opacity-50"
            >
              {resending ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                  </svg>
                  Re-queueing...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Resend {selected.size} selected
                </span>
              )}
            </Button>
          )}
        </div>
      )}

      {/* Records */}
      {records.length === 0 ? (
        <div className="flex flex-col items-center py-12 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
          <svg className="w-12 h-12 text-emerald-300 dark:text-emerald-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">✓ No Failed SMS Messages</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">All SMS messages were delivered successfully</p>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((r) => {
            const isSelected = selected.has(r.id)
            const isMaxAttempts = r.retry_count >= 3

            return (
              <div
                key={r.id}
                className={`group rounded-xl border p-4 transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? "border-[#6c63ff] bg-[#6c63ff]/5 shadow-md"
                    : "border-gray-100/50 dark:border-white/8 hover:bg-gray-50/50 dark:hover:bg-white/5 hover:shadow-sm"
                }`}
                onClick={() => toggleSelect(r.id)}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(r.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 shrink-0 w-4 h-4 rounded border-gray-300 dark:border-white/20 text-[#6c63ff] focus:ring-[#6c63ff]/20"
                    />
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white font-mono">
                          {r.recipient_phone}
                        </p>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 border border-gray-200/50 dark:border-white/10">
                          {r.trigger_event}
                        </span>
                        {isMaxAttempts && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200/50 dark:border-red-800/30">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {r.retry_count} attempts
                          </span>
                        )}
                        {!isMaxAttempts && (
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            {r.retry_count} attempt{r.retry_count === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                        {r.message_body}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">
                        {new Date(r.created_at).toLocaleString()}
                        {r.last_attempted_at && (
                          <>
                            <span className="text-gray-300 dark:text-white/20"> · </span>
                            Last attempt: {new Date(r.last_attempted_at).toLocaleString()}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleResend([r.id])
                      }}
                      disabled={resending}
                      className="rounded-lg border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-[#6c63ff]/40 hover:text-[#6c63ff] transition-all"
                    >
                      {resending ? (
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                        </svg>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Resend
                        </span>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}