// components/admin/seat-capacity-manager.tsx
// Redesigned seat capacity configuration UI with modern styling

"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import SensitiveActionModal from "@/components/admin/sensitive-action-modal"

interface AcademicYear {
  id: string
  name: string
  status: string
}

interface BranchGradeConfig {
  id: string
  branch_id: string
  grade_id: string
  branches: { id: string; name: string; code: string }
  grades: { id: string; name: string; level_order: number }
}

interface StreamConfig {
  id: string
  branch_id: string
  grade_id: string
  stream_id: string
  streams: { id: string; name: string }
}

interface Capacity {
  id: string
  branch_id: string
  grade_id: string
  stream_id: string | null
  total_seats: number
  pending_seats: number
  reserved_seats: number
  enrolled_seats: number
  waitlist_capacity: number
  waitlist_count: number
  waitlist_window_hours: number
}

interface CapacityFormValues {
  totalSeats: string
  waitlistCapacity: string
  waitlistWindowHours: string
}

interface SeatCapacityManagerProps {
  academicYears: AcademicYear[]
}

export default function SeatCapacityManager({
  academicYears,
}: SeatCapacityManagerProps) {
  const [selectedYearId, setSelectedYearId] = useState(
    academicYears[0]?.id ?? ""
  )
  const [configs, setConfigs] = useState<BranchGradeConfig[]>([])
  const [streamConfigs, setStreamConfigs] = useState<StreamConfig[]>([])
  const [capacities, setCapacities] = useState<Capacity[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [formValues, setFormValues] = useState<Record<string, CapacityFormValues>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({})

  const fetchData = useCallback(async (yearId: string) => {
    if (!yearId) return
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/master/seat-capacities?academicYearId=${yearId}`
      )
      if (!response.ok) {
        setError("Could not load capacity data")
        return
      }
      const data = await response.json()
      setConfigs(data.configs ?? [])
      setStreamConfigs(data.streamConfigs ?? [])
      setCapacities(data.capacities ?? [])

      const initialValues: Record<string, CapacityFormValues> = {}
      for (const cap of data.capacities ?? []) {
        const key = `${cap.branch_id}_${cap.grade_id}_${cap.stream_id ?? "null"}`
        initialValues[key] = {
          totalSeats: String(cap.total_seats),
          waitlistCapacity: String(cap.waitlist_capacity),
          waitlistWindowHours: String(cap.waitlist_window_hours),
        }
      }
      setFormValues(initialValues)
    } catch {
      setError("Could not load capacity data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedYearId) fetchData(selectedYearId)
  }, [selectedYearId, fetchData])

  function getCapacity(branchId: string, gradeId: string, streamId: string | null): Capacity | null {
    return capacities.find(
      (c) => c.branch_id === branchId && c.grade_id === gradeId && c.stream_id === streamId
    ) ?? null
  }

  function getFormKey(branchId: string, gradeId: string, streamId: string | null): string {
    return `${branchId}_${gradeId}_${streamId ?? "null"}`
  }

  function getFormValue(key: string): CapacityFormValues {
    return formValues[key] ?? { totalSeats: "", waitlistCapacity: "0", waitlistWindowHours: "72" }
  }

  function updateFormValue(key: string, field: keyof CapacityFormValues, value: string) {
    setFormValues((prev) => ({
      ...prev,
      [key]: { ...getFormValue(key), [field]: value },
    }))
    setSaveErrors((prev) => ({ ...prev, [key]: "" }))
  }

  async function handleSave(
    branchId: string,
    gradeId: string,
    streamId: string | null,
    branchName: string,
    gradeName: string,
    streamName: string | null
  ) {
    const key = getFormKey(branchId, gradeId, streamId)
    const values = getFormValue(key)

    const totalSeats = parseInt(values.totalSeats, 10)
    const waitlistCapacity = parseInt(values.waitlistCapacity, 10)
    const waitlistWindowHours = parseInt(values.waitlistWindowHours, 10)

    if (isNaN(totalSeats) || totalSeats < 1) {
      setSaveErrors((prev) => ({ ...prev, [key]: "Total seats must be at least 1" }))
      return
    }
    if (isNaN(waitlistCapacity) || waitlistCapacity < 0) {
      setSaveErrors((prev) => ({ ...prev, [key]: "Waitlist capacity cannot be negative" }))
      return
    }
    if (isNaN(waitlistWindowHours) || waitlistWindowHours < 1 || waitlistWindowHours > 168) {
      setSaveErrors((prev) => ({ ...prev, [key]: "Waitlist window must be between 1 and 168 hours" }))
      return
    }

    setSavingKey(key)
    setSuccessMessage(null)

    try {
      const response = await fetch("/api/master/seat-capacities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academicYearId: selectedYearId,
          branchId,
          gradeId,
          streamId,
          totalSeats,
          waitlistCapacity,
          waitlistWindowHours,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setSaveErrors((prev) => ({ ...prev, [key]: data.error ?? "Could not save capacity" }))
        return
      }

      const label = streamName ? `${gradeName} (${streamName}) at ${branchName}` : `${gradeName} at ${branchName}`
      setSuccessMessage(`Capacity saved for ${label}.`)
      await fetchData(selectedYearId)
    } catch {
      setSaveErrors((prev) => ({ ...prev, [key]: "Could not save. Please try again." }))
    } finally {
      setSavingKey(null)
    }
  }

  const configsByBranch = configs.reduce<Record<string, BranchGradeConfig[]>>((acc, config) => {
    const branchId = config.branch_id
    if (!acc[branchId]) acc[branchId] = []
    acc[branchId]!.push(config)
    return acc
  }, {})

  const selectedYear = academicYears.find((y) => y.id === selectedYearId)
  const isArchived = selectedYear?.status === "ARCHIVED"

  if (academicYears.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
        <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No Academic Years Found</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Create one in Academic Years first</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Year selector with stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Academic Year:</label>
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
                <span className={`ml-1.5 text-[10px] ${selectedYearId === year.id ? "text-white/70" : "text-gray-400"}`}>
                  ({year.status})
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

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

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full border-4 border-[#6c63ff]/20 border-t-[#6c63ff] animate-spin" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading capacity data...</p>
          </div>
        </div>
      ) : configs.length === 0 ? (
        <div className="flex flex-col items-center py-12 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
          <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">No branch-grade configurations found</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Configure them in Branch-Grade Config first</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(configsByBranch).map(([branchId, branchConfigs]) => {
            const branchName = branchConfigs[0]?.branches.name ?? "Unknown"

            return (
              <div key={branchId} className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{branchName}</h3>
                  <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">
                    {branchConfigs.length} grade{branchConfigs.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="space-y-3">
                  {branchConfigs
                    .sort((a, b) => a.grades.level_order - b.grades.level_order)
                    .map((config) => {
                      const gradeStreamConfigs = streamConfigs.filter(
                        (sc) => sc.branch_id === config.branch_id && sc.grade_id === config.grade_id
                      )

                      if (gradeStreamConfigs.length > 0) {
                        return gradeStreamConfigs.map((sc) => {
                          const key = getFormKey(config.branch_id, config.grade_id, sc.stream_id)
                          const cap = getCapacity(config.branch_id, config.grade_id, sc.stream_id)
                          const values = getFormValue(key)
                          const saveError = saveErrors[key]
                          const currentUsage = cap ? cap.pending_seats + cap.reserved_seats + cap.enrolled_seats : 0

                          return (
                            <CapacityRow
                              key={key}
                              rowKey={key}
                              label={`${config.grades.name} — ${sc.streams.name}`}
                              cap={cap}
                              values={values}
                              currentUsage={currentUsage}
                              saveError={saveError ?? null}
                              isSaving={savingKey === key}
                              isArchived={isArchived}
                              onChange={(field, value) => updateFormValue(key, field, value)}
                              onSave={() =>
                                handleSave(
                                  config.branch_id,
                                  config.grade_id,
                                  sc.stream_id,
                                  branchName,
                                  config.grades.name,
                                  sc.streams.name
                                )
                              }
                              actionDescription={`Set capacity for ${config.grades.name} (${sc.streams.name}) at ${branchName}`}
                            />
                          )
                        })
                      }

                      const key = getFormKey(config.branch_id, config.grade_id, null)
                      const cap = getCapacity(config.branch_id, config.grade_id, null)
                      const values = getFormValue(key)
                      const saveError = saveErrors[key]
                      const currentUsage = cap ? cap.pending_seats + cap.reserved_seats + cap.enrolled_seats : 0

                      return (
                        <CapacityRow
                          key={key}
                          rowKey={key}
                          label={config.grades.name}
                          cap={cap}
                          values={values}
                          currentUsage={currentUsage}
                          saveError={saveError ?? null}
                          isSaving={savingKey === key}
                          isArchived={isArchived}
                          onChange={(field, value) => updateFormValue(key, field, value)}
                          onSave={() =>
                            handleSave(
                              config.branch_id,
                              config.grade_id,
                              null,
                              branchName,
                              config.grades.name,
                              null
                            )
                          }
                          actionDescription={`Set capacity for ${config.grades.name} at ${branchName}`}
                        />
                      )
                    })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Individual capacity row component
interface CapacityRowProps {
  rowKey: string
  label: string
  cap: Capacity | null
  values: CapacityFormValues
  currentUsage: number
  saveError: string | null
  isSaving: boolean
  isArchived: boolean
  onChange: (field: keyof CapacityFormValues, value: string) => void
  onSave: () => void
  actionDescription: string
}

function CapacityRow({
  rowKey,
  label,
  cap,
  values,
  currentUsage,
  saveError,
  isSaving,
  isArchived,
  onChange,
  onSave,
  actionDescription,
}: CapacityRowProps) {
  const isStreamRow = label.includes("—")
  const icon = isStreamRow ? "🌊" : "📚"

  return (
    <div className="group rounded-xl border border-gray-100/50 dark:border-white/8 bg-white/50 dark:bg-white/3 p-5 transition-all duration-200 hover:shadow-md">
      <div className="flex flex-col md:flex-row md:items-start gap-4">
        {/* Label and status */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">{icon}</span>
            <p className="text-sm font-semibold text-gray-800 dark:text-white">{label}</p>
            {cap && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                cap.total_seats - (cap.pending_seats + cap.reserved_seats + cap.enrolled_seats) > 0
                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30"
                  : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/30"
              }`}>
                <span className={`w-1 h-1 rounded-full ${
                  cap.total_seats - (cap.pending_seats + cap.reserved_seats + cap.enrolled_seats) > 0
                    ? "bg-emerald-500"
                    : "bg-amber-500"
                }`} />
                {cap.enrolled_seats}/{cap.total_seats} seats
              </span>
            )}
          </div>
          {cap && (
            <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
              <span>{cap.enrolled_seats} enrolled</span>
              <span className="text-gray-300 dark:text-white/20">·</span>
              <span>{cap.pending_seats} pending</span>
              <span className="text-gray-300 dark:text-white/20">·</span>
              <span>{cap.reserved_seats} reserved</span>
              {cap.waitlist_count > 0 && (
                <>
                  <span className="text-gray-300 dark:text-white/20">·</span>
                  <span className="text-amber-500">{cap.waitlist_count} on waitlist</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Current usage warning */}
        {currentUsage > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-900/10 px-2.5 py-1 rounded-lg border border-amber-200/50 dark:border-amber-800/30 shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {currentUsage} used
          </div>
        )}
      </div>

      {!isArchived ? (
        <>
          <div className="mt-4 pt-4 border-t border-gray-100/50 dark:border-white/5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`seats-${rowKey}`} className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Total Seats
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <Input
                    id={`seats-${rowKey}`}
                    value={values.totalSeats}
                    onChange={(e) => onChange("totalSeats", e.target.value.replace(/\D/g, ""))}
                    placeholder="e.g. 40"
                    inputMode="numeric"
                    className="pl-8 rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20 h-10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`waitlist-${rowKey}`} className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Waitlist Cap
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <Input
                    id={`waitlist-${rowKey}`}
                    value={values.waitlistCapacity}
                    onChange={(e) => onChange("waitlistCapacity", e.target.value.replace(/\D/g, ""))}
                    placeholder="e.g. 10"
                    inputMode="numeric"
                    className="pl-8 rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20 h-10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`window-${rowKey}`} className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Window (hrs)
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <Input
                    id={`window-${rowKey}`}
                    value={values.waitlistWindowHours}
                    onChange={(e) => onChange("waitlistWindowHours", e.target.value.replace(/\D/g, ""))}
                    placeholder="72"
                    inputMode="numeric"
                    className="pl-8 rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20 h-10"
                  />
                </div>
              </div>
            </div>

            {saveError && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50/80 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20 mt-2">
                <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>
              </div>
            )}

            <div className="flex items-center gap-3 mt-4">
              <SensitiveActionModal
                actionDescription={actionDescription}
                onVerified={onSave}
                variant="outline"
                disabled={isSaving}
              >
                {isSaving ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                    </svg>
                    Saving...
                  </span>
                ) : cap ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Update Capacity
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Set Capacity
                  </span>
                )}
              </SensitiveActionModal>

              {currentUsage > 0 && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  ⚠️ Cannot set below {currentUsage} used seats
                </p>
              )}
            </div>
          </div>
        </>
      ) : cap && (
        <div className="mt-4 pt-4 border-t border-gray-100/50 dark:border-white/5">
          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              {cap.total_seats} seats
            </span>
            <span className="text-gray-300 dark:text-white/20">|</span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {cap.waitlist_capacity} waitlist
            </span>
            <span className="text-gray-300 dark:text-white/20">|</span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {cap.waitlist_window_hours}hr window
            </span>
          </div>
        </div>
      )}
    </div>
  )
}