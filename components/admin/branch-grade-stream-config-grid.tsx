// components/admin/branch-grade-stream-config-grid.tsx
// Redesigned stream configuration grid with modern UI

"use client"

import { useState, useEffect, useCallback } from "react"
import SensitiveActionModal from "@/components/admin/sensitive-action-modal"

interface AcademicYear {
  id: string
  name: string
  status: string
}

interface Grade {
  id: string
  name: string
  level_order: number
}

interface Stream {
  id: string
  name: string
  is_active: boolean
}

interface StreamConfig {
  id: string
  branch_id: string
  grade_id: string
  stream_id: string
  is_active: boolean
}

interface BranchGradeStreamConfigGridProps {
  academicYears: AcademicYear[]
}

export default function BranchGradeStreamConfigGrid({
  academicYears,
}: BranchGradeStreamConfigGridProps) {
  const [selectedYearId, setSelectedYearId] = useState<string>(
    academicYears[0]?.id ?? ""
  )
  const [grades, setGrades] = useState<Grade[]>([])
  const [streams, setStreams] = useState<Stream[]>([])
  const [configs, setConfigs] = useState<StreamConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [pendingCell, setPendingCell] = useState<{
    gradeId: string
    streamId: string
  } | null>(null)

  const fetchConfigs = useCallback(async (yearId: string) => {
    if (!yearId) return
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/master/branch-grade-stream-configs?academicYearId=${yearId}`
      )
      if (!response.ok) {
        setError("Could not load stream configurations")
        return
      }
      const data = await response.json()
      setGrades(data.grades ?? [])
      setStreams(data.streams ?? [])
      setConfigs(data.configs ?? [])
    } catch {
      setError("Could not load stream configurations")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedYearId) fetchConfigs(selectedYearId)
  }, [selectedYearId, fetchConfigs])

  function isEnabled(gradeId: string, streamId: string): boolean {
    return configs.some(
      (c) =>
        c.grade_id === gradeId &&
        c.stream_id === streamId &&
        c.is_active
    )
  }

  async function handleToggle(
    gradeId: string,
    streamId: string,
    currentlyEnabled: boolean
  ) {
    setError(null)
    setSuccessMessage(null)
    setPendingCell({ gradeId, streamId })

    try {
      const response = await fetch(
        "/api/master/branch-grade-stream-configs",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            academicYearId: selectedYearId,
            gradeId,
            streamId,
            isActive: !currentlyEnabled,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? "Could not update configuration")
        return
      }

      const grade = grades.find((g) => g.id === gradeId)
      const stream = streams.find((s) => s.id === streamId)
      setSuccessMessage(
        `${stream?.name} for ${grade?.name} ${!currentlyEnabled ? "enabled" : "disabled"}.`
      )
      await fetchConfigs(selectedYearId)
    } catch {
      setError("Could not update configuration. Please try again.")
    } finally {
      setPendingCell(null)
    }
  }

  const selectedYear = academicYears.find((y) => y.id === selectedYearId)
  const isArchived = selectedYear?.status === "ARCHIVED"

  // Calculate stats
  const totalCells = grades.length * streams.length
  const enabledCells = configs.filter((c) => c.is_active).length
  const enabledPercentage = totalCells > 0 ? Math.round((enabledCells / totalCells) * 100) : 0

  if (academicYears.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
        <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No Academic Years Found</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Create an academic year first in Step 23</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Year selector with stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Academic Year:
          </label>
          <div className="flex flex-wrap gap-1.5">
            {academicYears.map((year) => (
              <button
                key={year.id}
                onClick={() => setSelectedYearId(year.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                  selectedYearId === year.id
                    ? "bg-[#6c63ff] text-white shadow-lg shadow-[#6c63ff]/25"
                    : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10"
                }`}
              >
                {year.name}
                <span className={`ml-1.5 text-[10px] ${
                  selectedYearId === year.id ? "text-white/70" : "text-gray-400"
                }`}>
                  ({year.status})
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        {!loading && grades.length > 0 && streams.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 dark:text-gray-400">Enabled:</span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {enabledCells}/{totalCells}
              </span>
            </div>
            <div className="w-px h-5 bg-gray-200 dark:bg-white/10" />
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 dark:text-gray-400">Coverage:</span>
              <span className="text-sm font-bold text-[#6c63ff] dark:text-[#9d97ff]">
                {enabledPercentage}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Archived notice */}
      {isArchived && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50/80 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30">
          <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Archived Year</p>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-0.5">
              This academic year is archived — configurations are read-only.
            </p>
          </div>
        </div>
      )}

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

      {/* Branch info banner */}
      <div className="relative overflow-hidden rounded-xl bg-linear-to-br from-blue-50/80 to-blue-50/30 dark:from-blue-900/20 dark:to-blue-900/5 border border-blue-200/50 dark:border-blue-800/30 p-4">
        <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl" />
        <div className="relative flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-200/50 dark:border-blue-800/30 shrink-0">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
              Chereta Branch — Grades 11 and 12 Only
            </p>
            <p className="text-xs text-blue-600/80 dark:text-blue-400/80 leading-relaxed mt-0.5">
              Each grade can have Natural, Social, or both streams enabled.
            </p>
          </div>
        </div>
      </div>

      {/* Config Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full border-4 border-[#6c63ff]/20 border-t-[#6c63ff] animate-spin" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading stream configurations...</p>
          </div>
        </div>
      ) : grades.length === 0 ? (
        <div className="flex flex-col items-center py-12 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
          <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">Grades 11 and 12 Not Active</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Activate them in Grade Management first</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100/50 dark:border-white/8">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 text-left px-4 py-3 text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider border border-gray-100/50 dark:border-white/5 bg-gray-50/80 dark:bg-white/5 min-w-25">
                  Grade
                </th>
                {streams.map((stream) => {
                  const icon = stream.name.toLowerCase().includes("natural") ? "🌿" : "🌊"
                  return (
                    <th
                      key={stream.id}
                      className="px-4 py-3 text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider border border-gray-100/50 dark:border-white/5 bg-gray-50/80 dark:bg-white/5 text-center min-w-25"
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-lg">{icon}</span>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">
                          {stream.name}
                        </span>
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {grades.map((grade, rowIndex) => (
                <tr key={grade.id} className={rowIndex % 2 === 0 ? 'bg-white/50 dark:bg-white/3' : 'bg-gray-50/30 dark:bg-white/5'}>
                  <td className="sticky left-0 z-10 px-4 py-3 font-medium text-gray-800 dark:text-white border border-gray-100/50 dark:border-white/5 bg-white/80 dark:bg-[#13132b]/80 backdrop-blur-sm">
                    {grade.name}
                  </td>
                  {streams.map((stream) => {
                    const enabled = isEnabled(grade.id, stream.id)
                    const isPending =
                      pendingCell?.gradeId === grade.id &&
                      pendingCell?.streamId === stream.id

                    return (
                      <td
                        key={stream.id}
                        className="border border-gray-100/50 dark:border-white/5 text-center p-2"
                      >
                        {isArchived ? (
                          <span className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-sm font-bold transition-all duration-200 ${
                            enabled
                              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30"
                              : "bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-500 border border-gray-200/50 dark:border-white/10"
                          }`}>
                            {enabled ? "✓" : "–"}
                          </span>
                        ) : (
                          <SensitiveActionModal
                            actionDescription={`${enabled ? "Disable" : "Enable"} ${stream.name} stream for ${grade.name} at Chereta — ${selectedYear?.name}`}
                            onVerified={() =>
                              handleToggle(
                                grade.id,
                                stream.id,
                                enabled
                              )
                            }
                            variant="ghost"
                            disabled={isPending}
                          >
                            <span className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-sm font-bold transition-all duration-200 cursor-pointer hover:scale-110 ${
                              isPending
                                ? "bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-500"
                                : enabled
                                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30 hover:bg-emerald-200 dark:hover:bg-emerald-900/40"
                                : "bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-500 border border-gray-200/50 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10"
                            }`}>
                              {isPending ? (
                                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                                </svg>
                              ) : enabled ? "✓" : "–"}
                            </span>
                          </SensitiveActionModal>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend and info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold border border-emerald-200/50 dark:border-emerald-800/30">
              ✓
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Enabled</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-500 text-xs font-bold border border-gray-200/50 dark:border-white/10">
              –
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Disabled</span>
          </div>
          {!isArchived && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-500 text-xs font-bold border border-gray-200/50 dark:border-white/10">
                <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                </svg>
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Processing</span>
            </div>
          )}
        </div>
        <p className="text-[10px] text-gray-400 dark:text-gray-500">
          {isArchived ? "Read-only mode" : "Click any cell to toggle. Each change requires authenticator verification."}
        </p>
      </div>
    </div>
  )
}