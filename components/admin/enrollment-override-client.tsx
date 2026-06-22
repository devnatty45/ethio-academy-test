// components/admin/enrollment-override-client.tsx
// Redesigned enrollment override client with modern UI

"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { VALID_MANUAL_TRANSITIONS } from "@/lib/utils/enrollment-transitions"
import type { EnrollmentStatus } from "@/lib/utils/enrollment-transitions"

interface AcademicYear {
  id: string
  name: string
  status: string
}

interface EnrollmentResult {
  id: string
  status: string
  studentCategory: string
  submittedAt: string
  paymentDeadlineAt: string | null
  student: { stu_id: string; full_name: string }
  branchName: string
  gradeName: string
  academicYear: { id: string; name: string }
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  PENDING_REVIEW: {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200/50 dark:border-amber-800/30",
    dot: "bg-amber-500"
  },
  PAYMENT_PENDING: {
    bg: "bg-blue-50 dark:bg-blue-900/20",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200/50 dark:border-blue-800/30",
    dot: "bg-blue-500"
  },
  ENROLLED: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200/50 dark:border-emerald-800/30",
    dot: "bg-emerald-500"
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
  WAITLISTED: {
    bg: "bg-orange-50 dark:bg-orange-900/20",
    text: "text-orange-700 dark:text-orange-400",
    border: "border-orange-200/50 dark:border-orange-800/30",
    dot: "bg-orange-500"
  },
}

export default function EnrollmentOverrideClient({
  years,
}: {
  years: AcademicYear[]
}) {
  const [query, setQuery] = useState("")
  const [selectedYearId, setSelectedYearId] = useState("")
  const [results, setResults] = useState<EnrollmentResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const [selectedEnrollment, setSelectedEnrollment] = useState<EnrollmentResult | null>(null)
  const [targetStatus, setTargetStatus] = useState("")
  const [reason, setReason] = useState("")
  const [overriding, setOverriding] = useState(false)
  const [overrideError, setOverrideError] = useState<string | null>(null)
  const [overrideSuccess, setOverrideSuccess] = useState<string | null>(null)

  const handleSearch = useCallback(async () => {
    if (query.length < 2) return
    setSearching(true)
    setSearchError(null)
    setResults([])
    setSelectedEnrollment(null)
    try {
      const params = new URLSearchParams({ q: query })
      if (selectedYearId) params.set("academicYearId", selectedYearId)
      const response = await fetch(
        `/api/master/enrollments/search?${params.toString()}`
      )
      const data = await response.json()
      if (!response.ok) {
        setSearchError(data.error ?? "Search failed")
        return
      }
      setResults(data.enrollments ?? [])
    } catch {
      setSearchError("Search failed")
    } finally {
      setSearching(false)
    }
  }, [query, selectedYearId])

  async function handleOverride() {
    if (!selectedEnrollment || !targetStatus || reason.trim().length < 20) {
      setOverrideError("Reason must be at least 20 characters")
      return
    }

    setOverriding(true)
    setOverrideError(null)
    setOverrideSuccess(null)

    try {
      const response = await fetch("/api/master/enrollments/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollmentId: selectedEnrollment.id,
          toStatus: targetStatus,
          reason: reason.trim(),
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setOverrideError(data.error ?? "Override failed")
        return
      }
      setOverrideSuccess(
        `Successfully transitioned from ${data.fromStatus} → ${data.toStatus}`
      )
      setSelectedEnrollment({
        ...selectedEnrollment,
        status: data.toStatus,
      })
      setTargetStatus("")
      setReason("")
    } catch {
      setOverrideError("Override failed. Please try again.")
    } finally {
      setOverriding(false)
    }
  }

  const validTransitions = selectedEnrollment
    ? (VALID_MANUAL_TRANSITIONS[selectedEnrollment.status as EnrollmentStatus] ?? [])
    : []

  return (
    <div className="space-y-8">
      {/* Search section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Search Enrollments</h3>
          <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by student name or STU ID..."
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-9 rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
            />
          </div>
          
          <select
            value={selectedYearId}
            onChange={(e) => setSelectedYearId(e.target.value)}
            className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-transparent px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20 min-w-35"
          >
            <option value="">All years</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
          
          <Button
            onClick={handleSearch}
            disabled={searching || query.length < 2}
            className="rounded-lg bg-linear-to-r from-[#6c63ff] to-[#7c73ff] hover:from-[#5a52e0] hover:to-[#6c63ff] text-white shadow-lg shadow-[#6c63ff]/25 hover:shadow-[#6c63ff]/40 transition-all duration-300 disabled:opacity-50"
          >
            {searching ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                </svg>
                Searching...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search
              </span>
            )}
          </Button>
        </div>

        {searchError && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50/80 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20">
            <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-600 dark:text-red-400">{searchError}</p>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Found {results.length} enrollment{results.length === 1 ? "" : "s"}
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {results.map((r) => {
                const statusColor = STATUS_COLORS[r.status] || STATUS_COLORS.PENDING_REVIEW
                const isSelected = selectedEnrollment?.id === r.id
                
                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSelectedEnrollment(r)
                      setTargetStatus("")
                      setReason("")
                      setOverrideError(null)
                      setOverrideSuccess(null)
                    }}
                    className={`w-full text-left rounded-xl border p-4 transition-all duration-200 ${
                      isSelected
                        ? "border-[#6c63ff] bg-[#6c63ff]/5 shadow-md"
                        : "border-gray-100/50 dark:border-white/8 hover:bg-gray-50/50 dark:hover:bg-white/5 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {r.student.full_name}
                        </p>
                        <p className="text-xs font-mono text-gray-500 dark:text-gray-400">
                          STU {r.student.stu_id}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                          <span>{r.academicYear.name}</span>
                          <span className="text-gray-300 dark:text-white/20">·</span>
                          <span>{r.branchName}</span>
                          <span className="text-gray-300 dark:text-white/20">·</span>
                          <span>{r.gradeName}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium ${statusColor.bg} ${statusColor.text} ${statusColor.border} border`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusColor.dot}`} />
                          {r.status}
                        </span>
                        {isSelected && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#6c63ff]/10 text-[#6c63ff] border border-[#6c63ff]/20">
                            Selected
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {results.length === 0 && query.length >= 2 && !searching && !searchError && (
          <div className="flex flex-col items-center py-8 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl">
            <svg className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-sm text-gray-500 dark:text-gray-400">No enrollments found</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Try adjusting your search</p>
          </div>
        )}
      </div>

      {/* Override form */}
      {selectedEnrollment && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Status Override</h3>
            <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
          </div>

          <div className="rounded-xl border border-gray-100/50 dark:border-white/8 bg-white/50 dark:bg-white/3 p-5 space-y-4">
            {/* Selected enrollment summary */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#6c63ff]/5 border border-[#6c63ff]/20">
              <div className="w-10 h-10 rounded-xl bg-[#6c63ff]/10 flex items-center justify-center border border-[#6c63ff]/20">
                <span className="text-sm font-bold text-[#6c63ff]">
                  {selectedEnrollment.student.full_name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {selectedEnrollment.student.full_name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  STU {selectedEnrollment.student.stu_id} · {selectedEnrollment.gradeName} · {selectedEnrollment.branchName}
                </p>
              </div>
              <div className="ml-auto">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                  STATUS_COLORS[selectedEnrollment.status]?.bg || "bg-gray-100 dark:bg-white/10"
                } ${
                  STATUS_COLORS[selectedEnrollment.status]?.text || "text-gray-600 dark:text-gray-400"
                } border ${
                  STATUS_COLORS[selectedEnrollment.status]?.border || "border-gray-200/50 dark:border-white/10"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    STATUS_COLORS[selectedEnrollment.status]?.dot || "bg-gray-400"
                  }`} />
                  Current: {selectedEnrollment.status}
                </span>
              </div>
            </div>

            {overrideSuccess && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-900/10 border border-emerald-200/50 dark:border-emerald-800/20 animate-in fade-in slide-in-from-top-2 duration-300">
                <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Success</p>
                  <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">{overrideSuccess}</p>
                </div>
              </div>
            )}

            {overrideError && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50/80 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20 animate-in fade-in slide-in-from-top-2 duration-300">
                <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-red-700 dark:text-red-400">Error</p>
                  <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">{overrideError}</p>
                </div>
              </div>
            )}

            {validTransitions.length === 0 ? (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/20">
                <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-amber-600 dark:text-amber-400">No valid transitions available from this status.</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Target Status <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {validTransitions.map((t) => {
                      const statusColor = STATUS_COLORS[t.to] || STATUS_COLORS.PENDING_REVIEW
                      const isSelected = targetStatus === t.to
                      
                      return (
                        <button
                          key={t.to}
                          onClick={() => setTargetStatus(t.to)}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-200 ${
                            isSelected
                              ? `${statusColor.bg} ${statusColor.text} ${statusColor.border} border-2`
                              : "bg-white dark:bg-transparent text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5"
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${statusColor.dot}`} />
                            {t.to}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Reason <span className="text-red-500">*</span>
                    <span className="text-gray-400 font-normal ml-1">(minimum 20 characters)</span>
                  </Label>
                  <div className="relative">
                    <Textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Explain why this override is necessary..."
                      rows={3}
                      maxLength={1000}
                      className="rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20 resize-none"
                    />
                    <p className={`text-[10px] text-right mt-1 ${
                      reason.length >= 20 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400 dark:text-gray-500"
                    }`}>
                      {reason.length}/20 minimum
                      {reason.length >= 20 && " ✓"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50/50 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20">
                  <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-red-700 dark:text-red-400">⚠️ Warning</p>
                    <p className="text-xs text-red-600/80 dark:text-red-400/80 leading-relaxed">
                      This action is permanent and fully logged. Capacity counts will be adjusted automatically.
                    </p>
                  </div>
                </div>

                <Button
                  className="w-full bg-linear-to-r from-[#6c63ff] to-[#7c73ff] hover:from-[#5a52e0] hover:to-[#6c63ff] text-white rounded-xl py-3 font-semibold transition-all duration-300 shadow-lg shadow-[#6c63ff]/25 hover:shadow-[#6c63ff]/40 disabled:opacity-50 disabled:hover:shadow-lg"
                  onClick={handleOverride}
                  disabled={overriding || !targetStatus || reason.trim().length < 20}
                >
                  {overriding ? (
                    <span className="flex items-center justify-center gap-3">
                      <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                      </svg>
                      Applying Override...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      Override → {targetStatus || "Select a Status"}
                    </span>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}