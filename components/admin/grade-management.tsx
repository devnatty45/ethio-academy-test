// components/admin/grade-management.tsx
// Redesigned grade management UI with modern styling

"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import SensitiveActionModal from "@/components/admin/sensitive-action-modal"

interface Grade {
  id: string
  name: string
  level_order: number
  is_active: boolean
  created_at: string
}

export default function GradeManagement() {
  const [grades, setGrades] = useState<Grade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)

  // Add grade form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [newGradeName, setNewGradeName] = useState("")
  const [newGradeLevelOrder, setNewGradeLevelOrder] = useState("")
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const fetchGrades = useCallback(async () => {
    try {
      const response = await fetch("/api/master/grades")
      if (!response.ok) {
        setError("Could not load grades")
        return
      }
      const data = await response.json()
      setGrades(data.grades ?? [])
    } catch {
      setError("Could not load grades")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGrades()
  }, [fetchGrades])

  async function handleToggle(grade: Grade) {
    setError(null)
    setSuccessMessage(null)
    setProcessingId(grade.id)

    try {
      const response = await fetch(`/api/master/grades/${grade.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !grade.is_active }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? "Could not update grade")
        return
      }

      setSuccessMessage(
        `${grade.name} has been ${!grade.is_active ? "activated" : "deactivated"}.`
      )
      await fetchGrades()
    } catch {
      setError("Could not update grade. Please try again.")
    } finally {
      setProcessingId(null)
    }
  }

  async function handleAddGrade() {
    setAddError(null)

    const name = newGradeName.trim()
    const levelOrder = parseInt(newGradeLevelOrder, 10)

    if (!name) {
      setAddError("Grade name is required")
      return
    }
    if (isNaN(levelOrder) || levelOrder < 1 || levelOrder > 100) {
      setAddError("Level order must be a number between 1 and 100")
      return
    }

    setAdding(true)

    try {
      const response = await fetch("/api/master/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, levelOrder }),
      })

      const data = await response.json()

      if (!response.ok) {
        setAddError(data.error ?? "Could not add grade")
        return
      }

      setSuccessMessage(`Grade "${name}" added successfully.`)
      setNewGradeName("")
      setNewGradeLevelOrder("")
      setShowAddForm(false)
      await fetchGrades()
    } catch {
      setAddError("Could not add grade. Please try again.")
    } finally {
      setAdding(false)
    }
  }

  // Calculate stats
  const activeCount = grades.filter((g) => g.is_active).length
  const inactiveCount = grades.filter((g) => !g.is_active).length
  const highestLevel = grades.length > 0 ? Math.max(...grades.map((g) => g.level_order)) : 0

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full border-4 border-[#6c63ff]/20 border-t-[#6c63ff] animate-spin" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading grades...</p>
          </div>
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-gray-100/50 dark:border-white/5">
                <div className="flex items-center gap-4">
                  <div className="h-6 w-8 rounded bg-gray-200 dark:bg-white/10" />
                  <div className="h-4 w-32 rounded bg-gray-200 dark:bg-white/10" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-6 w-16 rounded bg-gray-200 dark:bg-white/10" />
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
          <p className="text-2xl font-bold text-[#6c63ff] dark:text-[#9d97ff]">{grades.length}</p>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Total Grades</p>
        </div>
        <div className="rounded-xl bg-linear-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-200/50 dark:border-emerald-800/30 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{activeCount}</p>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Active</p>
        </div>
        <div className="rounded-xl bg-linear-to-br from-gray-500/10 to-gray-600/10 border border-gray-200/50 dark:border-white/10 p-4 text-center">
          <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{inactiveCount}</p>
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

      {/* Grade list */}
      <div className="rounded-xl border border-gray-100/50 dark:border-white/8 overflow-hidden bg-white/50 dark:bg-white/3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80 dark:bg-white/5 border-b border-gray-100/50 dark:border-white/5">
              <tr>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  Order
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  Grade Name
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100/50 dark:divide-white/5">
              {grades.map((grade) => (
                <tr key={grade.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors duration-150">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/5 text-xs font-mono font-semibold text-gray-600 dark:text-gray-400">
                      {grade.level_order}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-semibold text-gray-800 dark:text-white">
                      {grade.name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium ${
                      grade.is_active
                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30"
                        : "bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 border border-gray-200/50 dark:border-white/10"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        grade.is_active ? "bg-emerald-500" : "bg-gray-400"
                      }`} />
                      {grade.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <SensitiveActionModal
                      actionDescription={`${grade.is_active ? "Deactivate" : "Activate"} grade: ${grade.name}`}
                      onVerified={() => handleToggle(grade)}
                      variant={grade.is_active ? "outline" : "default"}
                      disabled={processingId === grade.id}
                    >
                      {processingId === grade.id ? (
                        <span className="flex items-center gap-1.5">
                          <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                          </svg>
                          ...
                        </span>
                      ) : grade.is_active ? (
                        <span className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
                          </svg>
                          Deactivate
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Activate
                        </span>
                      )}
                    </SensitiveActionModal>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add grade form */}
      {showAddForm ? (
        <div className="rounded-xl border border-gray-100/50 dark:border-white/8 bg-white/50 dark:bg-white/3 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Add New Grade</h3>
            <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="grade-name" className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Grade Name <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <Input
                  id="grade-name"
                  value={newGradeName}
                  onChange={(e) => setNewGradeName(e.target.value)}
                  placeholder="e.g. Grade 13"
                  maxLength={50}
                  className="pl-9 rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="level-order" className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Level Order <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <Input
                  id="level-order"
                  value={newGradeLevelOrder}
                  onChange={(e) =>
                    setNewGradeLevelOrder(
                      e.target.value.replace(/\D/g, "")
                    )
                  }
                  placeholder="e.g. 16"
                  inputMode="numeric"
                  maxLength={3}
                  className="pl-9 rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
                />
              </div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">
                Determines sort order. Current highest: <span className="font-medium text-gray-600 dark:text-gray-300">{highestLevel}</span>
              </p>
            </div>
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
                setNewGradeName("")
                setNewGradeLevelOrder("")
                setAddError(null)
              }}
              disabled={adding}
              className="rounded-xl border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5"
            >
              Cancel
            </Button>
            <SensitiveActionModal
              actionDescription={`Add new grade: ${newGradeName || "(unnamed)"} at level order ${newGradeLevelOrder || "?"}`}
              onVerified={handleAddGrade}
              disabled={adding || !newGradeName.trim() || !newGradeLevelOrder}
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
                  Add Grade
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
            Add New Grade
          </span>
        </Button>
      )}

      {/* Empty state */}
      {grades.length === 0 && !loading && (
        <div className="flex flex-col items-center py-12 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
          <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">No grades found</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Click "Add New Grade" to get started</p>
        </div>
      )}
    </div>
  )
}