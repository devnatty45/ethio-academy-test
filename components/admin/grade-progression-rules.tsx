// components/admin/grade-progression-rules.tsx
// Redesigned grade progression rules management UI

"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import SensitiveActionModal from "@/components/admin/sensitive-action-modal"

interface Branch {
  id: string
  name: string
}

interface Grade {
  id: string
  name: string
  level_order: number
}

interface ProgressionRule {
  id: string
  is_active: boolean
  created_at: string
  from_grade: { id: string; name: string; level_order: number }
  from_branch: { id: string; name: string }
  to_grade: { id: string; name: string; level_order: number }
  to_branch: { id: string; name: string }
}

export default function GradeProgressionRules() {
  const [rules, setRules] = useState<ProgressionRule[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  // Add form state
  const [fromGradeId, setFromGradeId] = useState("")
  const [fromBranchId, setFromBranchId] = useState("")
  const [toGradeId, setToGradeId] = useState("")
  const [toBranchId, setToBranchId] = useState("")
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const fetchRules = useCallback(async () => {
    try {
      const response = await fetch("/api/master/grade-progression-rules")
      if (!response.ok) {
        setError("Could not load rules")
        return
      }
      const data = await response.json()
      setRules(data.rules ?? [])
      setBranches(data.branches ?? [])
      setGrades(data.grades ?? [])
    } catch {
      setError("Could not load rules")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRules()
  }, [fetchRules])

  async function handleToggle(rule: ProgressionRule) {
    setError(null)
    setSuccessMessage(null)
    setProcessingId(rule.id)

    try {
      const response = await fetch(
        `/api/master/grade-progression-rules/${rule.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: !rule.is_active }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? "Could not update rule")
        return
      }

      setSuccessMessage(
        `Rule ${!rule.is_active ? "activated" : "deactivated"} successfully.`
      )
      await fetchRules()
    } catch {
      setError("Could not update rule. Please try again.")
    } finally {
      setProcessingId(null)
    }
  }

  async function handleAddRule() {
    setAddError(null)

    if (!fromGradeId || !fromBranchId || !toGradeId || !toBranchId) {
      setAddError("All four fields are required")
      return
    }

    setAdding(true)

    try {
      const response = await fetch("/api/master/grade-progression-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromGradeId,
          fromBranchId,
          toGradeId,
          toBranchId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setAddError(data.error ?? "Could not create rule")
        return
      }

      const fromGrade = grades.find((g) => g.id === fromGradeId)
      const fromBranch = branches.find((b) => b.id === fromBranchId)
      const toGrade = grades.find((g) => g.id === toGradeId)
      const toBranch = branches.find((b) => b.id === toBranchId)

      setSuccessMessage(
        `Rule created: ${fromGrade?.name} at ${fromBranch?.name} → ${toGrade?.name} at ${toBranch?.name}`
      )
      setFromGradeId("")
      setFromBranchId("")
      setToGradeId("")
      setToBranchId("")
      setShowAddForm(false)
      await fetchRules()
    } catch {
      setAddError("Could not create rule. Please try again.")
    } finally {
      setAdding(false)
    }
  }

  const activeRules = rules.filter((r) => r.is_active)
  const inactiveRules = rules.filter((r) => !r.is_active)

  const fromGrade = grades.find((g) => g.id === fromGradeId)
  const fromBranch = branches.find((b) => b.id === fromBranchId)
  const toGrade = grades.find((g) => g.id === toGradeId)
  const toBranch = branches.find((b) => b.id === toBranchId)

  const addDescription =
    fromGrade && fromBranch && toGrade && toBranch
      ? `Add progression rule: ${fromGrade.name} at ${fromBranch.name} → ${toGrade.name} at ${toBranch.name}`
      : "Add new grade progression rule"

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full border-4 border-[#6c63ff]/20 border-t-[#6c63ff] animate-spin" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading progression rules...</p>
          </div>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-gray-100/50 dark:border-white/5">
                <div className="space-y-2">
                  <div className="h-4 w-48 rounded bg-gray-200 dark:bg-white/10" />
                  <div className="h-3 w-32 rounded bg-gray-200 dark:bg-white/10" />
                </div>
                <div className="h-8 w-20 rounded bg-gray-200 dark:bg-white/10" />
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
          <p className="text-2xl font-bold text-[#6c63ff] dark:text-[#9d97ff]">{rules.length}</p>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Total Rules</p>
        </div>
        <div className="rounded-xl bg-linear-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-200/50 dark:border-emerald-800/30 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{activeRules.length}</p>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Active</p>
        </div>
        <div className="rounded-xl bg-linear-to-br from-gray-500/10 to-gray-600/10 border border-gray-200/50 dark:border-white/10 p-4 text-center">
          <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{inactiveRules.length}</p>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Inactive</p>
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

      {/* Active rules */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Active Rules</h3>
          <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30">
            {activeRules.length}
          </span>
          <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
        </div>

        {activeRules.length === 0 ? (
          <div className="flex flex-col items-center py-8 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl">
            <svg className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            <p className="text-sm text-gray-500 dark:text-gray-400">No active rules</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Add one below</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeRules.map((rule) => {
              const isProcessing = processingId === rule.id
              
              return (
                <div
                  key={rule.id}
                  className="group rounded-xl border border-emerald-200/50 dark:border-emerald-800/30 bg-emerald-50/30 dark:bg-emerald-900/5 p-4 transition-all duration-200 hover:shadow-md"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="text-center">
                          <p className="text-sm font-bold text-gray-800 dark:text-white">
                            {rule.from_grade.name}
                          </p>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400">
                            {rule.from_branch.name}
                          </p>
                        </div>
                        <div className="flex flex-col items-center">
                          <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                          <span className="text-[8px] text-emerald-500 font-medium">PROGRESS</span>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-bold text-gray-800 dark:text-white">
                            {rule.to_grade.name}
                          </p>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400">
                            {rule.to_branch.name}
                          </p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30">
                        <span className="w-1 h-1 rounded-full bg-emerald-500" />
                        Active
                      </span>
                    </div>
                    <SensitiveActionModal
                      actionDescription={`Deactivate rule: ${rule.from_grade.name} at ${rule.from_branch.name} → ${rule.to_grade.name} at ${rule.to_branch.name}`}
                      onVerified={() => handleToggle(rule)}
                      variant="outline"
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <span className="flex items-center gap-1.5">
                          <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                          </svg>
                          ...
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
                          </svg>
                          Deactivate
                        </span>
                      )}
                    </SensitiveActionModal>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add rule form */}
      {showAddForm ? (
        <div className="rounded-xl border border-gray-100/50 dark:border-white/8 bg-white/50 dark:bg-white/3 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Add New Progression Rule</h3>
            <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* From Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">From</span>
                <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="from-grade" className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Grade <span className="text-red-500">*</span>
                  </Label>
                  <select
                    id="from-grade"
                    value={fromGradeId}
                    onChange={(e) => setFromGradeId(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-transparent px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
                  >
                    <option value="">Select grade...</option>
                    {grades.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="from-branch" className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Branch <span className="text-red-500">*</span>
                  </Label>
                  <select
                    id="from-branch"
                    value={fromBranchId}
                    onChange={(e) => setFromBranchId(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-transparent px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
                  >
                    <option value="">Select branch...</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* To Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">To</span>
                <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="to-grade" className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Grade <span className="text-red-500">*</span>
                  </Label>
                  <select
                    id="to-grade"
                    value={toGradeId}
                    onChange={(e) => setToGradeId(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-transparent px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
                  >
                    <option value="">Select grade...</option>
                    {grades.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="to-branch" className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Branch <span className="text-red-500">*</span>
                  </Label>
                  <select
                    id="to-branch"
                    value={toBranchId}
                    onChange={(e) => setToBranchId(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-transparent px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
                  >
                    <option value="">Select branch...</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Preview */}
          {fromGrade && fromBranch && toGrade && toBranch && (
            <div className="flex items-center justify-center gap-3 p-3 rounded-lg bg-[#6c63ff]/5 border border-[#6c63ff]/20">
              <span className="text-sm font-semibold text-gray-800 dark:text-white">{fromGrade.name}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">at</span>
              <span className="text-sm font-semibold text-gray-800 dark:text-white">{fromBranch.name}</span>
              <svg className="w-5 h-5 text-[#6c63ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <span className="text-sm font-semibold text-gray-800 dark:text-white">{toGrade.name}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">at</span>
              <span className="text-sm font-semibold text-gray-800 dark:text-white">{toBranch.name}</span>
            </div>
          )}

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
                setFromGradeId("")
                setFromBranchId("")
                setToGradeId("")
                setToBranchId("")
                setAddError(null)
              }}
              disabled={adding}
              className="rounded-xl border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5"
            >
              Cancel
            </Button>
            <SensitiveActionModal
              actionDescription={addDescription}
              onVerified={handleAddRule}
              disabled={
                adding ||
                !fromGradeId ||
                !fromBranchId ||
                !toGradeId ||
                !toBranchId
              }
            >
              {adding ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                  </svg>
                  Adding...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Rule
                </span>
              )}
            </SensitiveActionModal>
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
            Add New Rule
          </span>
        </Button>
      )}

      {/* Inactive rules */}
      {inactiveRules.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400">Inactive Rules</h3>
            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-500/10 text-gray-500 border border-gray-200/50 dark:border-white/10">
              {inactiveRules.length}
            </span>
            <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
          </div>

          <div className="space-y-2">
            {inactiveRules.map((rule) => {
              const isProcessing = processingId === rule.id
              
              return (
                <div
                  key={rule.id}
                  className="group rounded-xl border border-gray-200/50 dark:border-white/5 bg-gray-50/30 dark:bg-white/3 p-4 opacity-60 transition-all duration-200 hover:opacity-100 hover:shadow-md"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="text-center">
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {rule.from_grade.name}
                          </p>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500">
                            {rule.from_branch.name}
                          </p>
                        </div>
                        <div className="flex flex-col items-center">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {rule.to_grade.name}
                          </p>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500">
                            {rule.to_branch.name}
                          </p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 border border-gray-200/50 dark:border-white/10">
                        <span className="w-1 h-1 rounded-full bg-gray-400" />
                        Inactive
                      </span>
                    </div>
                    <SensitiveActionModal
                      actionDescription={`Reactivate rule: ${rule.from_grade.name} at ${rule.from_branch.name} → ${rule.to_grade.name} at ${rule.to_branch.name}`}
                      onVerified={() => handleToggle(rule)}
                      variant="outline"
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <span className="flex items-center gap-1.5">
                          <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                          </svg>
                          ...
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-[#6c63ff] dark:text-[#9d97ff]">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Reactivate
                        </span>
                      )}
                    </SensitiveActionModal>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Info note */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-900/5 border border-blue-100/50 dark:border-blue-800/20">
        <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-xs font-medium text-blue-700 dark:text-blue-400">How Progression Works</p>
          <p className="text-xs text-blue-600/80 dark:text-blue-400/80 leading-relaxed mt-0.5">
            Students in the "From" grade-branch will automatically be progressed to the "To" grade-branch
            at the start of the next academic year. Only active rules are applied.
          </p>
        </div>
      </div>
    </div>
  )
}