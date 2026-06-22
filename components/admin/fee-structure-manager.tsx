// components/admin/fee-structure-manager.tsx
// Redesigned fee structure management UI with modern styling

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

interface FeeStructure {
  id: string
  branch_id: string
  grade_id: string
  stream_id: string | null
  registration_fee: number
  first_month_fee: number
  total_amount: number
  effective_from: string
  effective_until: string | null
}

interface FeeFormValues {
  registrationFee: string
  firstMonthFee: string
  totalAmount: string
}

interface FeeStructureManagerProps {
  academicYears: AcademicYear[]
}

export default function FeeStructureManager({
  academicYears,
}: FeeStructureManagerProps) {
  const [selectedYearId, setSelectedYearId] = useState(
    academicYears[0]?.id ?? ""
  )
  const [configs, setConfigs] = useState<BranchGradeConfig[]>([])
  const [streamConfigs, setStreamConfigs] = useState<StreamConfig[]>([])
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [formValues, setFormValues] = useState<Record<string, FeeFormValues>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({})

  const fetchData = useCallback(async (yearId: string) => {
    if (!yearId) return
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/master/fee-structures?academicYearId=${yearId}`
      )
      if (!response.ok) {
        setError("Could not load fee structures")
        return
      }
      const data = await response.json()
      setConfigs(data.configs ?? [])
      setStreamConfigs(data.streamConfigs ?? [])
      setFeeStructures(data.feeStructures ?? [])

      const initialValues: Record<string, FeeFormValues> = {}
      for (const fee of data.feeStructures ?? []) {
        if (fee.effective_until !== null) continue
        const key = `${fee.branch_id}_${fee.grade_id}_${fee.stream_id ?? "null"}`
        initialValues[key] = {
          registrationFee: String(fee.registration_fee),
          firstMonthFee: String(fee.first_month_fee),
          totalAmount: String(fee.total_amount),
        }
      }
      setFormValues(initialValues)
    } catch {
      setError("Could not load fee structures")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedYearId) fetchData(selectedYearId)
  }, [selectedYearId, fetchData])

  function getKey(branchId: string, gradeId: string, streamId: string | null): string {
    return `${branchId}_${gradeId}_${streamId ?? "null"}`
  }

  function getActiveFee(branchId: string, gradeId: string, streamId: string | null): FeeStructure | null {
    return feeStructures.find(
      (f) =>
        f.branch_id === branchId &&
        f.grade_id === gradeId &&
        f.stream_id === streamId &&
        f.effective_until === null
    ) ?? null
  }

  function getFormValue(key: string): FeeFormValues {
    return formValues[key] ?? { registrationFee: "", firstMonthFee: "", totalAmount: "" }
  }

  function updateFormValue(key: string, field: keyof FeeFormValues, value: string) {
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
    label: string
  ) {
    const key = getKey(branchId, gradeId, streamId)
    const values = getFormValue(key)

    const registrationFee = parseFloat(values.registrationFee)
    const firstMonthFee = parseFloat(values.firstMonthFee)
    const totalAmount = parseFloat(values.totalAmount)

    if (isNaN(registrationFee) || registrationFee < 0) {
      setSaveErrors((prev) => ({ ...prev, [key]: "Registration fee must be 0 or more" }))
      return
    }
    if (isNaN(firstMonthFee) || firstMonthFee < 0) {
      setSaveErrors((prev) => ({ ...prev, [key]: "First month fee must be 0 or more" }))
      return
    }
    if (isNaN(totalAmount) || totalAmount < 1) {
      setSaveErrors((prev) => ({ ...prev, [key]: "Total amount must be at least 1" }))
      return
    }

    setSavingKey(key)
    setSuccessMessage(null)

    try {
      const response = await fetch("/api/master/fee-structures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academicYearId: selectedYearId,
          branchId,
          gradeId,
          streamId,
          registrationFee,
          firstMonthFee,
          totalAmount,
          effectiveFrom: new Date().toISOString(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setSaveErrors((prev) => ({ ...prev, [key]: data.error ?? "Could not save fee structure" }))
        return
      }

      setSuccessMessage(`Fee saved for ${label}.`)
      await fetchData(selectedYearId)
    } catch {
      setSaveErrors((prev) => ({ ...prev, [key]: "Could not save. Please try again." }))
    } finally {
      setSavingKey(null)
    }
  }

  const configsByBranch = configs.reduce<Record<string, BranchGradeConfig[]>>((acc, c) => {
    if (!acc[c.branch_id]) acc[c.branch_id] = []
    acc[c.branch_id]!.push(c)
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
      {/* Year selector */}
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
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading fee structures...</p>
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
                          const key = getKey(config.branch_id, config.grade_id, sc.stream_id)
                          const activeFee = getActiveFee(config.branch_id, config.grade_id, sc.stream_id)
                          const values = getFormValue(key)
                          const label = `${config.grades.name} (${sc.streams.name}) at ${branchName}`

                          return (
                            <FeeRow
                              key={key}
                              rowKey={key}
                              label={label}
                              activeFee={activeFee}
                              values={values}
                              saveError={saveErrors[key] ?? null}
                              isSaving={savingKey === key}
                              isArchived={isArchived}
                              onChange={(field, value) => updateFormValue(key, field, value)}
                              onSave={() =>
                                handleSave(config.branch_id, config.grade_id, sc.stream_id, label)
                              }
                              actionDescription={`Set fee for ${label}`}
                            />
                          )
                        })
                      }

                      const key = getKey(config.branch_id, config.grade_id, null)
                      const activeFee = getActiveFee(config.branch_id, config.grade_id, null)
                      const values = getFormValue(key)
                      const label = `${config.grades.name} at ${branchName}`

                      return (
                        <FeeRow
                          key={key}
                          rowKey={key}
                          label={label}
                          activeFee={activeFee}
                          values={values}
                          saveError={saveErrors[key] ?? null}
                          isSaving={savingKey === key}
                          isArchived={isArchived}
                          onChange={(field, value) => updateFormValue(key, field, value)}
                          onSave={() =>
                            handleSave(config.branch_id, config.grade_id, null, label)
                          }
                          actionDescription={`Set fee for ${label}`}
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

// Fee row sub-component
interface FeeRowProps {
  rowKey: string
  label: string
  activeFee: FeeStructure | null
  values: FeeFormValues
  saveError: string | null
  isSaving: boolean
  isArchived: boolean
  onChange: (field: keyof FeeFormValues, value: string) => void
  onSave: () => void
  actionDescription: string
}

function FeeRow({
  rowKey,
  label,
  activeFee,
  values,
  saveError,
  isSaving,
  isArchived,
  onChange,
  onSave,
  actionDescription,
}: FeeRowProps) {
  const isStreamRow = label.includes("(")
  const icon = isStreamRow ? "🌊" : "📚"

  return (
    <div className="group rounded-xl border border-gray-100/50 dark:border-white/8 bg-white/50 dark:bg-white/3 p-5 transition-all duration-200 hover:shadow-md">
      <div className="flex flex-col md:flex-row md:items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">{icon}</span>
            <p className="text-sm font-semibold text-gray-800 dark:text-white">{label}</p>
          </div>
          {activeFee && (
            <div className="flex items-center gap-3 mt-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#6c63ff]/10 text-[#6c63ff] dark:text-[#9d97ff] border border-[#6c63ff]/20">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                {activeFee.total_amount.toLocaleString()} ETB
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {activeFee.registration_fee.toLocaleString()} reg + {activeFee.first_month_fee.toLocaleString()} month
              </span>
            </div>
          )}
        </div>
      </div>

      {!isArchived ? (
        <>
          <div className="mt-4 pt-4 border-t border-gray-100/50 dark:border-white/5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`reg-${rowKey}`} className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Registration Fee
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-sm font-medium text-gray-400">ETB</span>
                  </div>
                  <Input
                    id={`reg-${rowKey}`}
                    value={values.registrationFee}
                    onChange={(e) => onChange("registrationFee", e.target.value)}
                    placeholder="e.g. 500"
                    inputMode="decimal"
                    className="pl-12 rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20 h-10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`month-${rowKey}`} className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  First Month Fee
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-sm font-medium text-gray-400">ETB</span>
                  </div>
                  <Input
                    id={`month-${rowKey}`}
                    value={values.firstMonthFee}
                    onChange={(e) => onChange("firstMonthFee", e.target.value)}
                    placeholder="e.g. 1200"
                    inputMode="decimal"
                    className="pl-12 rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20 h-10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`total-${rowKey}`} className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Total Amount
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-sm font-medium text-gray-400">ETB</span>
                  </div>
                  <Input
                    id={`total-${rowKey}`}
                    value={values.totalAmount}
                    onChange={(e) => onChange("totalAmount", e.target.value)}
                    placeholder="e.g. 1700"
                    inputMode="decimal"
                    className="pl-12 rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20 h-10"
                  />
                </div>
              </div>
            </div>

            {activeFee && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/20 mt-3">
                <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    <span className="font-medium">Current:</span> {activeFee.registration_fee.toLocaleString()} + {activeFee.first_month_fee.toLocaleString()} = {activeFee.total_amount.toLocaleString()} ETB
                  </p>
                  <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">
                    Changing this will only affect new approvals. Already-approved enrollments keep their current fee.
                  </p>
                </div>
              </div>
            )}

            {saveError && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50/80 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20 mt-3">
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
                ) : activeFee ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Update Fee
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Set Fee
                  </span>
                )}
              </SensitiveActionModal>
            </div>
          </div>
        </>
      ) : activeFee ? (
        <div className="mt-4 pt-4 border-t border-gray-100/50 dark:border-white/5">
          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              {activeFee.registration_fee.toLocaleString()} reg
            </span>
            <span className="text-gray-300 dark:text-white/20">+</span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {activeFee.first_month_fee.toLocaleString()} month
            </span>
            <span className="text-gray-300 dark:text-white/20">=</span>
            <span className="flex items-center gap-1.5 font-semibold text-[#6c63ff]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              {activeFee.total_amount.toLocaleString()} ETB
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-4 pt-4 border-t border-gray-100/50 dark:border-white/5">
          <p className="text-xs text-gray-400 dark:text-gray-500">No fee set</p>
        </div>
      )}
    </div>
  )
}