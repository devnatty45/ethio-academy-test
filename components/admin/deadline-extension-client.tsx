// components/admin/deadline-extension-client.tsx
// Redesigned deadline extension client with modern UI

"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface AcademicYear {
  id: string
  name: string
  status: string
}

interface EnrollmentResult {
  id: string
  status: string
  submittedAt: string
  paymentDeadlineAt: string | null
  student: { stu_id: string; full_name: string }
  branchName: string
  gradeName: string
  academicYear: { id: string; name: string }
}

export default function DeadlineExtensionClient({
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
  const [newDeadline, setNewDeadline] = useState("")
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Calculate max allowed deadline (7 days from now)
  const maxDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16)

  const minDeadline = new Date(Date.now() + 60 * 1000)
    .toISOString()
    .slice(0, 16)

  const handleSearch = useCallback(async () => {
    if (query.length < 2) return
    setSearching(true)
    setSearchError(null)
    setResults([])
    setSelectedEnrollment(null)
    setError(null)
    setSuccess(null)

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
      const pending = (data.enrollments ?? []).filter(
        (e: EnrollmentResult) => e.status === "PAYMENT_PENDING"
      )
      setResults(pending)
      if (pending.length === 0) {
        setSearchError("No PAYMENT_PENDING enrollments found for this search")
      }
    } catch {
      setSearchError("Search failed")
    } finally {
      setSearching(false)
    }
  }, [query, selectedYearId])

  async function handleExtend() {
    if (!selectedEnrollment || !newDeadline) {
      setError("Select a new deadline")
      return
    }
    if (reason.trim().length < 20) {
      setError("Reason must be at least 20 characters")
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/master/enrollments/extend-deadline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollmentId: selectedEnrollment.id,
          newDeadline: new Date(newDeadline).toISOString(),
          reason: reason.trim(),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? "Extension failed")
        return
      }

      const oldDate = data.oldDeadline
        ? new Date(data.oldDeadline).toLocaleString()
        : "none"
      const newDate = new Date(data.newDeadline).toLocaleString()

      setSuccess(`Deadline extended from ${oldDate} to ${newDate}`)
      setSelectedEnrollment({
        ...selectedEnrollment,
        paymentDeadlineAt: data.newDeadline,
      })
      setNewDeadline("")
      setReason("")
    } catch {
      setError("Extension failed. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Search section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Search Enrollments</h3>
          <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
            PAYMENT_PENDING only
          </span>
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
              Found {results.length} enrollment{results.length === 1 ? "" : "s"} with PAYMENT_PENDING status
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {results.map((r) => {
                const isSelected = selectedEnrollment?.id === r.id
                const hasDeadline = r.paymentDeadlineAt !== null
                
                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSelectedEnrollment(r)
                      setError(null)
                      setSuccess(null)
                      setNewDeadline("")
                      setReason("")
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
                      <div className="flex flex-col items-end gap-1">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          PAYMENT_PENDING
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Deadline: {hasDeadline ? new Date(r.paymentDeadlineAt!).toLocaleString() : "Not set"}
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
            <p className="text-sm text-gray-500 dark:text-gray-400">No PAYMENT_PENDING enrollments found</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Try adjusting your search</p>
          </div>
        )}
      </div>

      {/* Extension form */}
      {selectedEnrollment && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Extend Deadline</h3>
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
              <div className="ml-auto text-right">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  PAYMENT_PENDING
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Deadline: {selectedEnrollment.paymentDeadlineAt ? new Date(selectedEnrollment.paymentDeadlineAt).toLocaleString() : "Not set"}
                </p>
              </div>
            </div>

            {success && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-900/10 border border-emerald-200/50 dark:border-emerald-800/20 animate-in fade-in slide-in-from-top-2 duration-300">
                <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Success</p>
                  <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">{success}</p>
                </div>
              </div>
            )}

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

            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                New Deadline <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <Input
                  type="datetime-local"
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  min={minDeadline}
                  max={maxDeadline}
                  className="pl-9 rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
                />
              </div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">
                Max extension: {new Date(maxDeadline).toLocaleString()}
              </p>
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
                  placeholder="Explain why this deadline extension is necessary..."
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

            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/20">
              <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">⚠️ Warning</p>
                <p className="text-xs text-amber-600/80 dark:text-amber-400/80 leading-relaxed">
                  This change is permanent and fully logged. The guardian will see the updated deadline immediately.
                </p>
              </div>
            </div>

            <Button
              className="w-full bg-linear-to-r from-[#6c63ff] to-[#7c73ff] hover:from-[#5a52e0] hover:to-[#6c63ff] text-white rounded-xl py-3 font-semibold transition-all duration-300 shadow-lg shadow-[#6c63ff]/25 hover:shadow-[#6c63ff]/40 disabled:opacity-50 disabled:hover:shadow-lg"
              onClick={handleExtend}
              disabled={submitting || !newDeadline || reason.trim().length < 20}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-3">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                  </svg>
                  Extending...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Extend Payment Deadline
                </span>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}