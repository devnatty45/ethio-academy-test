// components/admin/branch-grade-config-grid.tsx
// Redesigned branch × grade configuration grid with modern UI

"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import SensitiveActionModal from "@/components/admin/sensitive-action-modal"

interface AcademicYear {
  id: string
  name: string
  status: string
}

interface Branch {
  id: string
  name: string
  code: string
}

interface Grade {
  id: string
  name: string
  level_order: number
}

interface Config {
  id: string
  branch_id: string
  grade_id: string
  is_active: boolean
}

interface BranchGradeConfigGridProps {
  academicYears: AcademicYear[]
}

export default function BranchGradeConfigGrid({
  academicYears,
}: BranchGradeConfigGridProps) {
  const [selectedYearId, setSelectedYearId] = useState<string>(
    academicYears[0]?.id ?? ""
  )
  const [branches, setBranches] = useState<Branch[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [configs, setConfigs] = useState<Config[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [pendingCell, setPendingCell] = useState<{
    branchId: string
    gradeId: string
    isActive: boolean
  } | null>(null)

  const fetchConfigs = useCallback(async (yearId: string) => {
    if (!yearId) return
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/master/branch-grade-configs?academicYearId=${yearId}`
      )
      if (!response.ok) {
        setError("Could not load configurations")
        return
      }
      const data = await response.json()
      setBranches(data.branches ?? [])
      setGrades(data.grades ?? [])
      setConfigs(data.configs ?? [])
    } catch {
      setError("Could not load configurations")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedYearId) fetchConfigs(selectedYearId)
  }, [selectedYearId, fetchConfigs])

  function isEnabled(branchId: string, gradeId: string): boolean {
    return configs.some(
      (c) =>
        c.branch_id === branchId &&
        c.grade_id === gradeId &&
        c.is_active
    )
  }

  async function handleToggle(
    branchId: string,
    gradeId: string,
    currentlyEnabled: boolean
  ) {
    setError(null)
    setSuccessMessage(null)
    setPendingCell({ branchId, gradeId, isActive: !currentlyEnabled })

    try {
      const response = await fetch("/api/master/branch-grade-configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academicYearId: selectedYearId,
          branchId,
          gradeId,
          isActive: !currentlyEnabled,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? "Could not update configuration")
        setPendingCell(null)
        return
      }

      const branch = branches.find((b) => b.id === branchId)
      const grade = grades.find((g) => g.id === gradeId)
      setSuccessMessage(
        `${grade?.name} at ${branch?.name} ${!currentlyEnabled ? "enabled" : "disabled"}.`
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
  const totalCells = branches.length * grades.length
  const enabledCells = configs.filter((c) => c.is_active).length
  const enabledPercentage = totalCells > 0 ? Math.round((enabledCells / totalCells) * 100) : 0

  if (academicYears.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
        <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
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
        {!loading && branches.length > 0 && grades.length > 0 && (
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

      {/* Config Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full border-4 border-[#6c63ff]/20 border-t-[#6c63ff] animate-spin" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading configurations...</p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100/50 dark:border-white/8">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 text-left px-4 py-3 text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider border border-gray-100/50 dark:border-white/5 bg-gray-50/80 dark:bg-white/5 min-w-25">
                  Grade
                </th>
                {branches.map((branch) => (
                  <th
                    key={branch.id}
                    className="px-3 py-3 text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider border border-gray-100/50 dark:border-white/5 bg-gray-50/80 dark:bg-white/5 text-center min-w-20"
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {branch.name}
                      </span>
                      <span className="text-[8px] text-gray-400 dark:text-gray-500">
                        {branch.code}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grades.map((grade, rowIndex) => (
                <tr key={grade.id} className={rowIndex % 2 === 0 ? 'bg-white/50 dark:bg-white/3' : 'bg-gray-50/30 dark:bg-white/5'}>
                  <td className="sticky left-0 z-10 px-4 py-3 font-medium text-gray-800 dark:text-white border border-gray-100/50 dark:border-white/5 bg-white/80 dark:bg-[#13132b]/80 backdrop-blur-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-400 dark:text-gray-500">
                        {String(grade.level_order).padStart(2, '0')}
                      </span>
                      <span>{grade.name}</span>
                    </div>
                  </td>
                  {branches.map((branch) => {
                    const enabled = isEnabled(branch.id, grade.id)
                    const isPending =
                      pendingCell?.branchId === branch.id &&
                      pendingCell?.gradeId === grade.id

                    return (
                      <td
                        key={branch.id}
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
                            actionDescription={`${enabled ? "Disable" : "Enable"} ${grade.name} at ${branch.name} for ${selectedYear?.name}`}
                            onVerified={() =>
                              handleToggle(branch.id, grade.id, enabled)
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