// components/admin/document-requirement-rules.tsx
// Redesigned document requirement rules UI with modern styling

"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import SensitiveActionModal from "@/components/admin/sensitive-action-modal"

interface Grade {
  id: string
  name: string
  level_order: number
}

interface DocumentRule {
  id: string
  doc_type: string
  student_category: string
  is_required: boolean
  is_reusable: boolean
  requires_fresh_upload: boolean
  applies_when_entering_grade_id: string | null
  description: string | null
  is_active: boolean
  created_at: string
  entering_grade: { id: string; name: string } | null
}

const CATEGORY_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  ALL: { label: "All Students", icon: "👥", color: "from-blue-500/10 to-blue-600/10 border-blue-200/50 dark:border-blue-800/30" },
  NEW: { label: "New Students", icon: "🆕", color: "from-emerald-500/10 to-emerald-600/10 border-emerald-200/50 dark:border-emerald-800/30" },
  EXISTING: { label: "Existing Students", icon: "📚", color: "from-amber-500/10 to-amber-600/10 border-amber-200/50 dark:border-amber-800/30" },
  RETURNING: { label: "Returning Students", icon: "🔄", color: "from-purple-500/10 to-purple-600/10 border-purple-200/50 dark:border-purple-800/30" },
}

const DOC_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  guardian_photo: { label: "Guardian Photo", icon: "👤" },
  student_photo: { label: "Student Photo", icon: "🧑" },
  national_id_front: { label: "National ID (Front)", icon: "🪪" },
  national_id_back: { label: "National ID (Back)", icon: "🪪" },
  birth_certificate: { label: "Birth Certificate", icon: "📜" },
  grade_certificate: { label: "Grade Certificate", icon: "🎓" },
  grade_6_exam_cert: { label: "Grade 6 Exam Certificate", icon: "📝" },
  grade_8_exam_cert: { label: "Grade 8 Exam Certificate", icon: "📝" },
}

function docTypeLabel(docType: string): string {
  return DOC_TYPE_LABELS[docType]?.label ?? docType
}

function docTypeIcon(docType: string): string {
  return DOC_TYPE_LABELS[docType]?.icon ?? "📄"
}

export default function DocumentRequirementRules() {
  const [rules, setRules] = useState<DocumentRule[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [showAddExamForm, setShowAddExamForm] = useState(false)

  // Add exam rule form
  const [examDocType, setExamDocType] = useState("")
  const [examGradeId, setExamGradeId] = useState("")
  const [examDescription, setExamDescription] = useState("")
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const fetchRules = useCallback(async () => {
    try {
      const response = await fetch("/api/master/document-requirement-rules")
      if (!response.ok) {
        setError("Could not load rules")
        return
      }
      const data = await response.json()
      setRules(data.rules ?? [])
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

  async function handleToggle(rule: DocumentRule) {
    setError(null)
    setSuccessMessage(null)
    setProcessingId(rule.id)

    try {
      const response = await fetch(
        `/api/master/document-requirement-rules/${rule.id}`,
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

      setSuccessMessage(`Rule ${!rule.is_active ? "activated" : "deactivated"} successfully.`)
      await fetchRules()
    } catch {
      setError("Could not update rule. Please try again.")
    } finally {
      setProcessingId(null)
    }
  }

  async function handleAddExamRule() {
    setAddError(null)

    if (!examDocType.trim()) {
      setAddError("Document type name is required")
      return
    }
    if (!examGradeId) {
      setAddError("Target grade is required")
      return
    }
    if (examDescription.trim().length < 5) {
      setAddError("Description must be at least 5 characters")
      return
    }

    setAdding(true)

    try {
      const response = await fetch("/api/master/document-requirement-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docType: examDocType.trim(),
          enteringGradeId: examGradeId,
          description: examDescription.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setAddError(data.error ?? "Could not create rule")
        return
      }

      setSuccessMessage("New exam certificate rule created.")
      setExamDocType("")
      setExamGradeId("")
      setExamDescription("")
      setShowAddExamForm(false)
      await fetchRules()
    } catch {
      setAddError("Could not create rule. Please try again.")
    } finally {
      setAdding(false)
    }
  }

  // Group rules by doc type
  const rulesByDocType = rules.reduce<Record<string, DocumentRule[]>>((acc, rule) => {
    if (!acc[rule.doc_type]) acc[rule.doc_type] = []
    acc[rule.doc_type]!.push(rule)
    return acc
  }, {})

  // Separate exam cert rules from standard rules
  const examDocTypes = rules
    .filter((r) => r.applies_when_entering_grade_id !== null)
    .map((r) => r.doc_type)
    .filter((v, i, a) => a.indexOf(v) === i)

  const standardDocTypes = Object.keys(rulesByDocType).filter(
    (dt) => !examDocTypes.includes(dt)
  )

  const selectedGrade = grades.find((g) => g.id === examGradeId)
  const addDescription = examDocType && selectedGrade
    ? `Add exam cert rule: ${examDocType} required when entering ${selectedGrade.name}`
    : "Add new exam certificate rule"

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full border-4 border-[#6c63ff]/20 border-t-[#6c63ff] animate-spin" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading document rules...</p>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="p-4 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-gray-100/50 dark:border-white/5">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="h-4 w-32 rounded bg-gray-200 dark:bg-white/10" />
                    <div className="h-3 w-48 rounded bg-gray-200 dark:bg-white/10" />
                  </div>
                  <div className="h-6 w-16 rounded bg-gray-200 dark:bg-white/10" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Calculate stats
  const totalRules = rules.length
  const activeRules = rules.filter((r) => r.is_active).length
  const examRules = rules.filter((r) => r.applies_when_entering_grade_id !== null).length

  return (
    <div className="space-y-8">
      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-linear-to-br from-[#6c63ff]/10 to-[#8b83ff]/10 border border-[#6c63ff]/20 p-4 text-center">
          <p className="text-2xl font-bold text-[#6c63ff] dark:text-[#9d97ff]">{totalRules}</p>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Total Rules</p>
        </div>
        <div className="rounded-xl bg-linear-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-200/50 dark:border-emerald-800/30 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{activeRules}</p>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Active</p>
        </div>
        <div className="rounded-xl bg-linear-to-br from-amber-500/10 to-amber-600/10 border border-amber-200/50 dark:border-amber-800/30 p-4 text-center">
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{examRules}</p>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Exam Rules</p>
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

      {/* Standard document rules */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Standard Document Rules</h3>
          <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#6c63ff]/10 text-[#6c63ff] border border-[#6c63ff]/20">
            {standardDocTypes.length}
          </span>
          <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
        </div>

        {standardDocTypes.length === 0 ? (
          <div className="flex flex-col items-center py-8 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl">
            <svg className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm text-gray-500 dark:text-gray-400">No standard rules found</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Run the seed SQL in Step 26</p>
          </div>
        ) : (
          <div className="space-y-3">
            {standardDocTypes.map((docType) => {
              const docRules = rulesByDocType[docType] ?? []
              const docIcon = docTypeIcon(docType)
              const docLabel = docTypeLabel(docType)

              return (
                <div
                  key={docType}
                  className="rounded-xl border border-gray-100/50 dark:border-white/8 overflow-hidden bg-white/50 dark:bg-white/3"
                >
                  <div className="flex items-center gap-2 px-4 py-3 bg-gray-50/50 dark:bg-white/5 border-b border-gray-100/50 dark:border-white/5">
                    <span className="text-lg">{docIcon}</span>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">{docLabel}</p>
                  </div>
                  <div className="divide-y divide-gray-100/50 dark:divide-white/5">
                    {docRules.map((rule) => {
                      const category = CATEGORY_LABELS[rule.student_category]
                      const isActive = rule.is_active
                      const isProcessing = processingId === rule.id

                      return (
                        <div key={rule.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3">
                          <div className="flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm bg-linear-to-br ${category?.color || "from-gray-500/10 to-gray-600/10"} border`}>
                              {category?.icon || "📋"}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {category?.label || rule.student_category}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                  rule.is_reusable
                                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/30"
                                    : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/30"
                                }`}>
                                  {rule.is_reusable ? "♻️ Reusable" : "📤 Fresh Upload"}
                                </span>
                                {rule.is_required && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200/50 dark:border-red-800/30">
                                    ⚠️ Required
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium ${
                              isActive
                                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30"
                                : "bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 border border-gray-200/50 dark:border-white/10"
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-gray-400"}`} />
                              {isActive ? "Active" : "Inactive"}
                            </span>
                            <SensitiveActionModal
                              actionDescription={`${isActive ? "Deactivate" : "Activate"} rule: ${docLabel} for ${category?.label || rule.student_category}`}
                              onVerified={() => handleToggle(rule)}
                              variant="ghost"
                              disabled={isProcessing}
                            >
                              <span className={`text-xs font-medium ${
                                isActive
                                  ? "text-gray-400 hover:text-red-500 hover:underline"
                                  : "text-gray-400 hover:text-emerald-500 hover:underline"
                              } transition-colors`}>
                                {isProcessing ? "..." : isActive ? "Deactivate" : "Activate"}
                              </span>
                            </SensitiveActionModal>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Exam certificate rules */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">National Exam Certificate Rules</h3>
          <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/30">
            {examRules}
          </span>
          <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
        </div>

        {examDocTypes.length === 0 ? (
          <div className="flex flex-col items-center py-8 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl">
            <svg className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm text-gray-500 dark:text-gray-400">No exam certificate rules found</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Run the seed SQL in Step 26</p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-100/50 dark:border-white/8 overflow-hidden bg-white/50 dark:bg-white/3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/80 dark:bg-white/5 border-b border-gray-100/50 dark:border-white/5">
                  <tr>
                    <th className="text-left px-4 py-3 text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      Document Type
                    </th>
                    <th className="text-left px-4 py-3 text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      Required When Entering
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
                  {rules
                    .filter((r) => r.applies_when_entering_grade_id !== null)
                    .map((rule) => {
                      const isActive = rule.is_active
                      const isProcessing = processingId === rule.id
                      const docIcon = docTypeIcon(rule.doc_type)
                      const docLabel = docTypeLabel(rule.doc_type)

                      return (
                        <tr key={rule.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{docIcon}</span>
                              <div>
                                <p className="text-sm font-semibold text-gray-800 dark:text-white">
                                  {docLabel}
                                </p>
                                {rule.description && (
                                  <p className="text-xs text-gray-400 dark:text-gray-500">{rule.description}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/30">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                              {rule.entering_grade?.name ?? "Unknown grade"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium ${
                              isActive
                                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30"
                                : "bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 border border-gray-200/50 dark:border-white/10"
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-gray-400"}`} />
                              {isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <SensitiveActionModal
                              actionDescription={`${isActive ? "Deactivate" : "Activate"} exam cert rule: ${docLabel} for ${rule.entering_grade?.name}`}
                              onVerified={() => handleToggle(rule)}
                              variant="ghost"
                              disabled={isProcessing}
                            >
                              <span className={`text-xs font-medium ${
                                isActive
                                  ? "text-gray-400 hover:text-red-500 hover:underline"
                                  : "text-gray-400 hover:text-emerald-500 hover:underline"
                              } transition-colors`}>
                                {isProcessing ? "..." : isActive ? "Deactivate" : "Activate"}
                              </span>
                            </SensitiveActionModal>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add exam cert rule form */}
        {showAddExamForm ? (
          <div className="rounded-xl border border-gray-100/50 dark:border-white/8 bg-white/50 dark:bg-white/3 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Add New Exam Certificate Rule</h4>
              <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="exam-doc-type" className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Certificate Document Type <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="exam-doc-type"
                  value={examDocType}
                  onChange={(e) =>
                    setExamDocType(
                      e.target.value
                        .toLowerCase()
                        .replace(/\s+/g, "_")
                        .replace(/[^a-z0-9_]/g, "")
                    )
                  }
                  placeholder="e.g. grade_10_exam_cert"
                  maxLength={100}
                  className="rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20 font-mono"
                />
                <p className="text-[10px] text-gray-400 dark:text-gray-500">
                  Use snake_case. Example: grade_10_exam_cert
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="exam-grade" className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Required When Entering Grade <span className="text-red-500">*</span>
                </Label>
                <select
                  id="exam-grade"
                  value={examGradeId}
                  onChange={(e) => setExamGradeId(e.target.value)}
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="exam-description" className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="exam-description"
                value={examDescription}
                onChange={(e) => setExamDescription(e.target.value)}
                placeholder="e.g. Grade 10 national exam certificate — required when entering Grade 11"
                maxLength={500}
                rows={2}
                className="rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20 resize-none"
              />
              <p className="text-[10px] text-gray-400 dark:text-gray-500 text-right">
                {examDescription.length}/500 characters
              </p>
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
                  setShowAddExamForm(false)
                  setExamDocType("")
                  setExamGradeId("")
                  setExamDescription("")
                  setAddError(null)
                }}
                disabled={adding}
                className="rounded-xl border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5"
              >
                Cancel
              </Button>
              <SensitiveActionModal
                actionDescription={addDescription}
                onVerified={handleAddExamRule}
                disabled={adding || !examDocType || !examGradeId || examDescription.length < 5}
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
              setShowAddExamForm(true)
              setSuccessMessage(null)
              setError(null)
            }}
            className="w-full md:w-auto rounded-xl border-2 border-dashed border-gray-300 dark:border-white/20 text-gray-600 dark:text-gray-400 hover:border-[#6c63ff]/40 hover:text-[#6c63ff] hover:bg-[#6c63ff]/5 transition-all duration-200"
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add New Exam Certificate Rule
            </span>
          </Button>
        )}
      </div>

      {/* Info note */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-900/5 border border-blue-100/50 dark:border-blue-800/20">
        <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-xs font-medium text-blue-700 dark:text-blue-400">How Document Rules Work</p>
          <p className="text-xs text-blue-600/80 dark:text-blue-400/80 leading-relaxed mt-0.5">
            Standard rules (guardian photo, student photo, national ID, birth certificate, grade certificate)
            cannot be added via UI — they are system defaults. Only exam certificate rules for new grade
            thresholds can be added here. Deactivated rules no longer apply to new enrollments but are
            preserved on historical records.
          </p>
        </div>
      </div>
    </div>
  )
}