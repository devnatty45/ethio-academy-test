// components/admin/academic-year-management.tsx
// Redesigned academic year management UI with modern styling

"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import SensitiveActionModal from "@/components/admin/sensitive-action-modal"

interface AcademicYear {
  id: string
  name: string
  start_year: number
  end_year: number
  status: string
  created_at: string
  updated_at: string
}

interface ReadinessCheck {
  check: string
  passed: boolean
  message: string
}

const STATUS_ORDER: Record<string, number> = {
  CONFIGURATION: 0,
  OPEN: 1,
  CLOSED: 2,
  ARCHIVED: 3,
}

const STATUS_LABELS: Record<string, string> = {
  CONFIGURATION: "Configuration",
  OPEN: "Open",
  CLOSED: "Closed",
  ARCHIVED: "Archived",
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  CONFIGURATION: {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200/50 dark:border-amber-800/30",
    dot: "bg-amber-500"
  },
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
  ARCHIVED: {
    bg: "bg-gray-50 dark:bg-white/5 opacity-60",
    text: "text-gray-500 dark:text-gray-500",
    border: "border-gray-200/50 dark:border-white/10",
    dot: "bg-gray-400"
  },
}

const NEXT_STATUS: Record<string, string | null> = {
  CONFIGURATION: "OPEN",
  OPEN: "CLOSED",
  CLOSED: "ARCHIVED",
  ARCHIVED: null,
}

const NEXT_STATUS_LABEL: Record<string, string> = {
  CONFIGURATION: "Open Enrollment",
  OPEN: "Close Enrollment",
  CLOSED: "Archive Year",
  ARCHIVED: "",
}

const STATUS_ICONS: Record<string, string> = {
  CONFIGURATION: "⚙️",
  OPEN: "📖",
  CLOSED: "🔒",
  ARCHIVED: "📦",
}

export default function AcademicYearManagement() {
  const router = useRouter()
  const [years, setYears] = useState<AcademicYear[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [readiness, setReadiness] = useState<Record<string, ReadinessCheck[]>>({})

  // Add form
  const [showAddForm, setShowAddForm] = useState(false)
  const [startYear, setStartYear] = useState("")
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  // Transition reason
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [reasonErrors, setReasonErrors] = useState<Record<string, string>>({})
  const [transitionErrors, setTransitionErrors] = useState<Record<string, string>>({})
  const [failedChecks, setFailedChecks] = useState<Record<string, string[]>>({})

  const fetchYears = useCallback(async () => {
    try {
      const response = await fetch("/api/master/academic-years")
      if (!response.ok) {
        setError("Could not load academic years")
        return
      }
      const data = await response.json()
      setYears(data.years ?? [])
    } catch {
      setError("Could not load academic years")
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchReadiness = useCallback(async (yearId: string) => {
    try {
      const response = await fetch(`/api/master/academic-years/${yearId}`)
      if (!response.ok) return
      const data = await response.json()
      setReadiness((prev) => ({
        ...prev,
        [yearId]: data.readiness ?? [],
      }))
    } catch {
      // Silently fail
    }
  }, [])

  useEffect(() => {
    fetchYears()
  }, [fetchYears])

  useEffect(() => {
    years
      .filter((y) => y.status === "CONFIGURATION")
      .forEach((y) => fetchReadiness(y.id))
  }, [years, fetchReadiness])

  async function handleTransition(year: AcademicYear) {
    const targetStatus = NEXT_STATUS[year.status]
    if (!targetStatus) return

    setTransitionErrors((prev) => ({ ...prev, [year.id]: "" }))
    setFailedChecks((prev) => ({ ...prev, [year.id]: [] }))

    const reason = reasons[year.id] ?? ""
    if (reason.trim().length < 10) {
      setReasonErrors((prev) => ({
        ...prev,
        [year.id]: "Reason must be at least 10 characters",
      }))
      return
    }

    setProcessingId(year.id)

    try {
      const response = await fetch(`/api/master/academic-years/${year.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetStatus,
          reason: reason.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.failedChecks) {
          setFailedChecks((prev) => ({
            ...prev,
            [year.id]: data.failedChecks,
          }))
        }
        setTransitionErrors((prev) => ({
          ...prev,
          [year.id]: data.error ?? "Could not update academic year",
        }))
        return
      }

      setSuccessMessage(`${year.name} is now ${STATUS_LABELS[targetStatus]}.`)
      setReasons((prev) => ({ ...prev, [year.id]: "" }))
      await fetchYears()
    } catch {
      setTransitionErrors((prev) => ({
        ...prev,
        [year.id]: "Could not update. Please try again.",
      }))
    } finally {
      setProcessingId(null)
    }
  }

  async function handleAddYear() {
    setAddError(null)

    const year = parseInt(startYear, 10)
    if (isNaN(year) || year < 2020 || year > 2100) {
      setAddError("Enter a valid start year (e.g. 2025)")
      return
    }

    setAdding(true)

    try {
      const response = await fetch("/api/master/academic-years", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startYear: year }),
      })

      const data = await response.json()

      if (!response.ok) {
        setAddError(data.error ?? "Could not create academic year")
        return
      }

      setSuccessMessage(`Academic year ${year}/${year + 1} created.`)
      setStartYear("")
      setShowAddForm(false)
      await fetchYears()
    } catch {
      setAddError("Could not create academic year. Please try again.")
    } finally {
      setAdding(false)
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
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading academic years...</p>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="p-4 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-gray-100/50 dark:border-white/5">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="h-4 w-32 rounded bg-gray-200 dark:bg-white/10" />
                    <div className="h-3 w-24 rounded bg-gray-200 dark:bg-white/10" />
                  </div>
                  <div className="h-6 w-20 rounded bg-gray-200 dark:bg-white/10" />
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
          <p className="text-2xl font-bold text-[#6c63ff] dark:text-[#9d97ff]">{years.length}</p>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Total Years</p>
        </div>
        <div className="rounded-xl bg-linear-to-br from-amber-500/10 to-amber-600/10 border border-amber-200/50 dark:border-amber-800/30 p-4 text-center">
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {years.filter((y) => y.status === "CONFIGURATION").length}
          </p>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Configuration</p>
        </div>
        <div className="rounded-xl bg-linear-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-200/50 dark:border-emerald-800/30 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {years.filter((y) => y.status === "OPEN").length}
          </p>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Open</p>
        </div>
        <div className="rounded-xl bg-linear-to-br from-gray-500/10 to-gray-600/10 border border-gray-200/50 dark:border-white/10 p-4 text-center">
          <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">
            {years.filter((y) => y.status === "CLOSED" || y.status === "ARCHIVED").length}
          </p>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Closed/Archived</p>
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

      {successMessage && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-900/10 border border-emerald-200/50 dark:border-emerald-800/20 animate-in fade-in slide-in-from-top-2 duration-300">
          <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <div>
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Success</p>
            <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Year list */}
      <div className="space-y-4">
        {years.length === 0 ? (
          <div className="flex flex-col items-center py-12 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
            <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm text-gray-500 dark:text-gray-400">No academic years found</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Create one below to get started</p>
          </div>
        ) : (
          years.map((year) => {
            const nextStatus = NEXT_STATUS[year.status]
            const yearReadiness = readiness[year.id] ?? []
            const allChecksPassed = yearReadiness.every((c) => c.passed)
            const yearTransitionError = transitionErrors[year.id]
            const yearFailedChecks = failedChecks[year.id] ?? []
            const yearReasonError = reasonErrors[year.id]
            const statusColor = STATUS_COLORS[year.status]
            const statusIcon = STATUS_ICONS[year.status]
            const isArchived = year.status === "ARCHIVED"

            return (
              <div
                key={year.id}
                className={`rounded-xl border p-5 transition-all duration-200 hover:shadow-md ${
                  isArchived
                    ? "border-gray-200/50 dark:border-white/5 bg-gray-50/30 dark:bg-white/3 opacity-60"
                    : "border-gray-100/50 dark:border-white/8 bg-white dark:bg-white/3"
                }`}
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${statusColor.bg} ${statusColor.border} border`}>
                      {statusIcon}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {year.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {year.start_year} — {year.end_year}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${statusColor.bg} ${statusColor.text} ${statusColor.border} border`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusColor.dot}`} />
                      {STATUS_LABELS[year.status]}
                    </span>
                  </div>
                </div>

                {/* Readiness checks for CONFIGURATION years */}
                {year.status === "CONFIGURATION" && yearReadiness.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100/50 dark:border-white/5">
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                      Readiness for Opening Enrollment:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {yearReadiness.map((check) => (
                        <div key={check.check} className="flex items-center gap-2">
                          <span className={`text-xs ${check.passed ? "text-emerald-500" : "text-red-500"}`}>
                            {check.passed ? "✓" : "✗"}
                          </span>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {check.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Configure buttons for CONFIGURATION years */}
                {year.status === "CONFIGURATION" && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push("/dashboard/master/branch-grade-configs")}
                      className="rounded-lg border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-[#6c63ff]/40 hover:text-[#6c63ff]"
                    >
                      <span className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                        </svg>
                        Configure Grades
                      </span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push("/dashboard/master/seat-capacities")}
                      className="rounded-lg border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-[#6c63ff]/40 hover:text-[#6c63ff]"
                    >
                      <span className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        Set Capacities
                      </span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push("/dashboard/master/fee-structures")}
                      className="rounded-lg border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-[#6c63ff]/40 hover:text-[#6c63ff]"
                    >
                      <span className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                        Set Fees
                      </span>
                    </Button>
                  </div>
                )}

                {/* Transition errors */}
                {yearTransitionError && (
                  <div className="mt-4 p-3 rounded-lg bg-red-50/80 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20">
                    <p className="text-sm text-red-600 dark:text-red-400">{yearTransitionError}</p>
                    {yearFailedChecks.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {yearFailedChecks.map((msg, i) => (
                          <li key={i} className="text-xs text-red-500">• {msg}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Transition controls */}
                {nextStatus && (
                  <div className="mt-4 pt-4 border-t border-gray-100/50 dark:border-white/5 space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor={`reason-${year.id}`} className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        Reason for {NEXT_STATUS_LABEL[year.status].toLowerCase()}
                        <span className="text-red-500 ml-1">*</span>
                      </Label>
                      <Textarea
                        id={`reason-${year.id}`}
                        value={reasons[year.id] ?? ""}
                        onChange={(e) => {
                          setReasons((prev) => ({
                            ...prev,
                            [year.id]: e.target.value,
                          }))
                          setReasonErrors((prev) => ({
                            ...prev,
                            [year.id]: "",
                          }))
                          setTransitionErrors((prev) => ({
                            ...prev,
                            [year.id]: "",
                          }))
                        }}
                        placeholder={`Enter reason for ${NEXT_STATUS_LABEL[year.status].toLowerCase()}`}
                        maxLength={500}
                        rows={2}
                        className="rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20 resize-none"
                      />
                      {yearReasonError && (
                        <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {yearReasonError}
                        </p>
                      )}
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">
                        {reasons[year.id]?.length || 0}/500 characters
                        {reasons[year.id]?.length > 0 && reasons[year.id]?.length < 10 && ` (${10 - reasons[year.id]?.length} more needed)`}
                      </p>
                    </div>

                    <SensitiveActionModal
                      actionDescription={`${NEXT_STATUS_LABEL[year.status]}: ${year.name}`}
                      onVerified={() => handleTransition(year)}
                      variant={nextStatus === "OPEN" ? "default" : "outline"}
                      disabled={
                        processingId === year.id ||
                        (year.status === "CONFIGURATION" && !allChecksPassed)
                      }
                    >
                      {processingId === year.id ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                          </svg>
                          Processing...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          {nextStatus === "OPEN" ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
                            </svg>
                          )}
                          {NEXT_STATUS_LABEL[year.status]}
                        </span>
                      )}
                    </SensitiveActionModal>

                    {year.status === "CONFIGURATION" && !allChecksPassed && (
                      <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/20">
                        <svg className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          Complete all readiness checks before opening enrollment.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {isArchived && (
                  <div className="mt-4 flex items-center gap-2 p-2 rounded-lg bg-gray-50/50 dark:bg-white/5 border border-gray-200/50 dark:border-white/10">
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      This year is archived and read-only.
                    </p>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Add form */}
      {showAddForm ? (
        <div className="rounded-xl border border-gray-100/50 dark:border-white/8 bg-white/50 dark:bg-white/3 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Create New Academic Year</h3>
            <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="start-year" className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Start Year <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <Input
                  id="start-year"
                  value={startYear}
                  onChange={(e) => setStartYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="e.g. 2025"
                  inputMode="numeric"
                  maxLength={4}
                  className="pl-9 rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
                />
              </div>
              {startYear.length === 4 && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Will create: <span className="font-medium text-gray-700 dark:text-gray-300">{startYear}/{parseInt(startYear) + 1}</span>
                </p>
              )}
            </div>

            {addError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50/80 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20">
                <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-600 dark:text-red-400">{addError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddForm(false)
                  setStartYear("")
                  setAddError(null)
                }}
                disabled={adding}
                className="rounded-xl border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5"
              >
                Cancel
              </Button>
              <SensitiveActionModal
                actionDescription={`Create academic year ${startYear}/${parseInt(startYear || "0") + 1}`}
                onVerified={handleAddYear}
                disabled={adding || startYear.length !== 4}
              >
                {adding ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                    </svg>
                    Creating...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create Year
                  </span>
                )}
              </SensitiveActionModal>
            </div>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          onClick={() => {
            setShowAddForm(true)
            setSuccessMessage(null)
            setError(null)
          }}
          className="w-full md:w-auto rounded-xl border-2 border-dashed border-gray-300 dark:border-white/20 text-gray-600 dark:text-gray-400 hover:border-[#6c63ff]/40 hover:text-[#6c63ff] hover:bg-[#6c63ff]/5 transition-all duration-200"
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create New Academic Year
          </span>
        </Button>
      )}

      {/* Info note */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-900/5 border border-blue-100/50 dark:border-blue-800/20">
        <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-xs font-medium text-blue-700 dark:text-blue-400">How Academic Years Work</p>
          <p className="text-xs text-blue-600/80 dark:text-blue-400/80 leading-relaxed mt-0.5">
            Years progress from Configuration → Open → Closed → Archived. Only one year can be Open at a time.
            Opening a year requires all readiness checks to pass.
          </p>
        </div>
      </div>
    </div>
  )
}