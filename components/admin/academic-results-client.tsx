// components/admin/academic-results-client.tsx
// Redesigned academic results client with modern UI

"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import StreamChangeForm from "@/components/admin/stream-change-form"

interface AcademicYear {
  id: string
  name: string
  status: string
}

interface ResultEnrollment {
  id: string
  academicResult: string
  studentCategory: string
  student: { id: string; stu_id: string; full_name: string }
  grade: { id: string; name: string; level_order: number }
  stream: { id: string; name: string } | null
}

export default function AcademicResultsClient({
  years,
}: {
  years: AcademicYear[]
}) {
  const [selectedYearId, setSelectedYearId] = useState(
    years[0]?.id ?? ""
  )
  const [enrollments, setEnrollments] = useState<ResultEnrollment[]>(
    []
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [streamChangeOpenId, setStreamChangeOpenId] = useState<
    string | null
  >(null)
  const [allStreams, setAllStreams] = useState<
    { id: string; name: string }[]
  >([])

  const fetchEnrollments = useCallback(async () => {
    if (!selectedYearId) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/admin/branch/academic-results?academicYearId=${selectedYearId}`
      )
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? "Could not load enrollments")
        return
      }
      setEnrollments(data.enrollments ?? [])
    } catch {
      setError("Could not load enrollments")
    } finally {
      setLoading(false)
    }
  }, [selectedYearId])

  useEffect(() => {
    fetchEnrollments()
  }, [fetchEnrollments])

  useEffect(() => {
    async function fetchStreams() {
      try {
        const response = await fetch("/api/master/streams")
        const data = await response.json()
        setAllStreams(data.streams ?? [])
      } catch {
        // Non-fatal
      }
    }
    fetchStreams()
  }, [])

  async function setResult(
    enrollmentId: string,
    result: "PASSED" | "FAILED"
  ) {
    setSavingId(enrollmentId)
    setError(null)
    try {
      const response = await fetch(
        `/api/admin/branch/enrollments/${enrollmentId}/academic-result`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ academicResult: result }),
        }
      )
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? "Could not save result")
        return
      }
      setEnrollments((prev) =>
        prev.map((e) =>
          e.id === enrollmentId ? { ...e, academicResult: result } : e
        )
      )
    } catch {
      setError("Could not save result")
    } finally {
      setSavingId(null)
    }
  }

  const pendingCount = enrollments.filter(
    (e) => e.academicResult === "PENDING"
  ).length
  const passedCount = enrollments.filter(
    (e) => e.academicResult === "PASSED"
  ).length
  const failedCount = enrollments.filter(
    (e) => e.academicResult === "FAILED"
  ).length

  return (
    <div className="space-y-6">
      {/* Year selector with status */}
      <div className="space-y-3">
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Select Academic Year
        </label>
        <div className="relative">
          <select
            value={selectedYearId}
            onChange={(e) => setSelectedYearId(e.target.value)}
            className="w-full rounded-xl border-2 border-gray-200 dark:border-white/10 bg-white dark:bg-transparent px-4 py-3 text-sm text-gray-700 dark:text-gray-300 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20 appearance-none cursor-pointer transition-all duration-200"
          >
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name} ({y.status})
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Stats summary */}
      {!loading && enrollments.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30 p-3 text-center">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{pendingCount}</p>
            <p className="text-[10px] font-medium text-amber-600/80 dark:text-amber-400/80">Pending</p>
          </div>
          <div className="rounded-xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200/50 dark:border-emerald-800/30 p-3 text-center">
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{passedCount}</p>
            <p className="text-[10px] font-medium text-emerald-600/80 dark:text-emerald-400/80">Passed</p>
          </div>
          <div className="rounded-xl bg-red-50/50 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/30 p-3 text-center">
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{failedCount}</p>
            <p className="text-[10px] font-medium text-red-600/80 dark:text-red-400/80">Failed</p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50/80 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20">
          <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <div className="flex items-center justify-center py-8">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full border-4 border-[#6c63ff]/20 border-t-[#6c63ff] animate-spin" />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading enrollments...</p>
            </div>
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-gray-100/50 dark:border-white/5">
                  <div className="space-y-2">
                    <div className="h-4 w-32 rounded bg-gray-200 dark:bg-white/10" />
                    <div className="h-3 w-24 rounded bg-gray-200 dark:bg-white/10" />
                  </div>
                  <div className="flex gap-2">
                    <div className="h-8 w-16 rounded bg-gray-200 dark:bg-white/10" />
                    <div className="h-8 w-16 rounded bg-gray-200 dark:bg-white/10" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : enrollments.length === 0 ? (
        <div className="flex flex-col items-center py-12 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
          <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">No enrolled students found</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Try selecting a different academic year</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {pendingCount} of {enrollments.length} pending
            </p>
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              {Math.round(((passedCount + failedCount) / enrollments.length) * 100)}% complete
            </span>
          </div>

          <div className="space-y-2">
            {enrollments.map((e) => {
              const isPending = e.academicResult === "PENDING"
              const isPassed = e.academicResult === "PASSED"
              const isFailed = e.academicResult === "FAILED"
              const isSaving = savingId === e.id

              return (
                <div
                  key={e.id}
                  className={`group rounded-xl border p-4 transition-all duration-200 hover:shadow-md ${
                    isPassed
                      ? "border-emerald-200/50 dark:border-emerald-800/30 bg-emerald-50/30 dark:bg-emerald-900/5"
                      : isFailed
                      ? "border-red-200/50 dark:border-red-800/30 bg-red-50/30 dark:bg-red-900/5"
                      : "border-gray-100/50 dark:border-white/8 bg-white dark:bg-white/3 hover:border-[#6c63ff]/30"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {e.student.full_name}
                        </p>
                        <span className="text-xs font-mono text-gray-400 dark:text-gray-500">
                          STU {e.student.stu_id}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        <span>{e.grade.name}</span>
                        {e.stream && (
                          <>
                            <span className="text-gray-300 dark:text-white/20">·</span>
                            <span className="inline-flex items-center gap-1">
                              {e.stream.name}
                              <button
                                onClick={() =>
                                  setStreamChangeOpenId(
                                    streamChangeOpenId === e.id ? null : e.id
                                  )
                                }
                                className="text-[10px] text-[#6c63ff] hover:text-[#5a52e0] hover:underline transition-colors"
                              >
                                {streamChangeOpenId === e.id ? "Cancel" : "Change"}
                              </button>
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium ${
                        isPassed
                          ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30"
                          : isFailed
                          ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200/50 dark:border-red-800/30"
                          : "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 border border-gray-200/50 dark:border-white/10"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          isPassed ? "bg-emerald-500" :
                          isFailed ? "bg-red-500" :
                          "bg-gray-400"
                        }`} />
                        {e.academicResult}
                      </span>

                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          className={`rounded-lg px-3 py-1 h-8 text-xs font-medium transition-all duration-200 ${
                            isPassed
                              ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm shadow-emerald-500/25"
                              : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 border border-emerald-200/50 dark:border-emerald-800/30"
                          }`}
                          disabled={isSaving || isPassed}
                          onClick={() => setResult(e.id, "PASSED")}
                        >
                          {isSaving ? (
                            <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                            </svg>
                          ) : (
                            <span className="flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                              Pass
                            </span>
                          )}
                        </Button>

                        <Button
                          size="sm"
                          className={`rounded-lg px-3 py-1 h-8 text-xs font-medium transition-all duration-200 ${
                            isFailed
                              ? "bg-red-500 hover:bg-red-600 text-white shadow-sm shadow-red-500/25"
                              : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-200/50 dark:border-red-800/30"
                          }`}
                          disabled={isSaving || isFailed}
                          onClick={() => setResult(e.id, "FAILED")}
                        >
                          {isSaving ? (
                            <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                            </svg>
                          ) : (
                            <span className="flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Fail
                            </span>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Stream Change Form */}
                  {streamChangeOpenId === e.id && e.stream && (
                    <div className="mt-3 pt-3 border-t border-gray-100/50 dark:border-white/5">
                      <StreamChangeForm
                        enrollmentId={e.id}
                        currentStreamId={e.stream.id}
                        availableStreams={allStreams}
                        onSuccess={() => {
                          setStreamChangeOpenId(null)
                          fetchEnrollments()
                        }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}