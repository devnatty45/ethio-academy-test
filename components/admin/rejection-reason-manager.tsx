// components/admin/rejection-reason-manager.tsx
// Redesigned rejection reason management UI with modern styling

"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import SensitiveActionModal from "@/components/admin/sensitive-action-modal"

interface RejectionReason {
  id: string
  doc_type: string
  reason_text: string
  is_active: boolean
  created_at: string
  updated_at: string
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

export default function RejectionReasonManager() {
  const [reasons, setReasons] = useState<RejectionReason[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState("")

  // Add form state
  const [newDocType, setNewDocType] = useState("")
  const [newReasonText, setNewReasonText] = useState("")
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const fetchReasons = useCallback(async () => {
    try {
      const response = await fetch("/api/master/rejection-reasons")
      if (!response.ok) {
        setError("Could not load rejection reasons")
        return
      }
      const data = await response.json()
      setReasons(data.reasons ?? [])
    } catch {
      setError("Could not load rejection reasons")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReasons()
  }, [fetchReasons])

  async function handleToggle(reason: RejectionReason) {
    setError(null)
    setSuccessMessage(null)
    setProcessingId(reason.id)

    try {
      const response = await fetch(`/api/master/rejection-reasons/${reason.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !reason.is_active }),
      })

      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? "Could not update reason")
        return
      }

      setSuccessMessage(`Reason ${!reason.is_active ? "activated" : "deactivated"}.`)
      await fetchReasons()
    } catch {
      setError("Could not update. Please try again.")
    } finally {
      setProcessingId(null)
    }
  }

  async function handleEdit(reason: RejectionReason) {
    setError(null)
    setSuccessMessage(null)

    if (editText.trim().length < 5) {
      setError("Reason text must be at least 5 characters")
      return
    }

    setProcessingId(reason.id)

    try {
      const response = await fetch(`/api/master/rejection-reasons/${reason.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reasonText: editText.trim() }),
      })

      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? "Could not update reason")
        return
      }

      setSuccessMessage("Reason updated.")
      setEditingId(null)
      setEditText("")
      await fetchReasons()
    } catch {
      setError("Could not update. Please try again.")
    } finally {
      setProcessingId(null)
    }
  }

  async function handleAdd() {
    setAddError(null)

    if (!newDocType.trim()) {
      setAddError("Document type is required")
      return
    }
    if (newReasonText.trim().length < 5) {
      setAddError("Reason text must be at least 5 characters")
      return
    }

    setAdding(true)

    try {
      const response = await fetch("/api/master/rejection-reasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docType: newDocType.trim(),
          reasonText: newReasonText.trim(),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        setAddError(data.error ?? "Could not add reason")
        return
      }

      setSuccessMessage("Reason added successfully.")
      setNewDocType("")
      setNewReasonText("")
      setShowAddForm(false)
      await fetchReasons()
    } catch {
      setAddError("Could not add reason. Please try again.")
    } finally {
      setAdding(false)
    }
  }

  // Group by doc_type
  const byDocType = reasons.reduce<Record<string, RejectionReason[]>>((acc, r) => {
    if (!acc[r.doc_type]) acc[r.doc_type] = []
    acc[r.doc_type]!.push(r)
    return acc
  }, {})

  // Known doc types in display order
  const orderedDocTypes = [
    "guardian_photo",
    "student_photo",
    "national_id_front",
    "national_id_back",
    "birth_certificate",
    "grade_certificate",
    "grade_6_exam_cert",
    "grade_8_exam_cert",
  ]

  const allDocTypes = [
    ...orderedDocTypes.filter((dt) => byDocType[dt]),
    ...Object.keys(byDocType).filter((dt) => !orderedDocTypes.includes(dt)),
  ]

  // Calculate stats
  const totalReasons = reasons.length
  const activeReasons = reasons.filter((r) => r.is_active).length
  const inactiveReasons = reasons.filter((r) => !r.is_active).length

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full border-4 border-[#6c63ff]/20 border-t-[#6c63ff] animate-spin" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading rejection reasons...</p>
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
                  <div className="flex gap-2">
                    <div className="h-8 w-16 rounded bg-gray-200 dark:bg-white/10" />
                    <div className="h-8 w-20 rounded bg-gray-200 dark:bg-white/10" />
                  </div>
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
          <p className="text-2xl font-bold text-[#6c63ff] dark:text-[#9d97ff]">{totalReasons}</p>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Total Reasons</p>
        </div>
        <div className="rounded-xl bg-linear-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-200/50 dark:border-emerald-800/30 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{activeReasons}</p>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Active</p>
        </div>
        <div className="rounded-xl bg-linear-to-br from-gray-500/10 to-gray-600/10 border border-gray-200/50 dark:border-white/10 p-4 text-center">
          <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{inactiveReasons}</p>
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

      {/* Reasons list */}
      {allDocTypes.length === 0 ? (
        <div className="flex flex-col items-center py-12 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
          <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">No rejection reasons found</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Run the seed SQL in Step 27</p>
        </div>
      ) : (
        <div className="space-y-4">
          {allDocTypes.map((docType) => {
            const docReasons = byDocType[docType] ?? []
            const activeCount = docReasons.filter((r) => r.is_active).length
            const docIcon = docTypeIcon(docType)
            const docLabel = docTypeLabel(docType)

            return (
              <div
                key={docType}
                className="rounded-xl border border-gray-100/50 dark:border-white/8 overflow-hidden bg-white/50 dark:bg-white/3"
              >
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50/50 dark:bg-white/5 border-b border-gray-100/50 dark:border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{docIcon}</span>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">{docLabel}</p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">{activeCount}</span>
                    <span className="text-gray-400"> / </span>
                    <span className="font-medium">{docReasons.length}</span>
                    <span className="text-gray-400"> active</span>
                  </p>
                </div>

                <div className="divide-y divide-gray-100/50 dark:divide-white/5">
                  {docReasons.map((reason) => {
                    const isActive = reason.is_active
                    const isProcessing = processingId === reason.id
                    const isEditing = editingId === reason.id

                    return (
                      <div
                        key={reason.id}
                        className={`px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 transition-opacity duration-200 ${
                          !isActive ? "opacity-60" : ""
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </div>
                                  <Input
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    maxLength={500}
                                    className="pl-9 rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
                                    placeholder="Enter rejection reason..."
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <SensitiveActionModal
                                  actionDescription={`Edit rejection reason for ${docLabel}`}
                                  onVerified={() => handleEdit(reason)}
                                  variant="default"
                                  disabled={isProcessing}
                                >
                                  {isProcessing ? (
                                    <span className="flex items-center gap-2">
                                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                                      </svg>
                                      Saving...
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-2">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                      Save
                                    </span>
                                  )}
                                </SensitiveActionModal>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingId(null)
                                    setEditText("")
                                  }}
                                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                {reason.reason_text}
                              </span>
                              {!isActive && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 border border-gray-200/50 dark:border-white/10">
                                  <span className="w-1 h-1 rounded-full bg-gray-400" />
                                  Inactive
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {!isEditing && (
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingId(reason.id)
                                setEditText(reason.reason_text)
                                setError(null)
                              }}
                              className="text-gray-500 hover:text-[#6c63ff] dark:text-gray-400 dark:hover:text-[#9d97ff]"
                            >
                              <span className="flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Edit
                              </span>
                            </Button>
                            <SensitiveActionModal
                              actionDescription={`${isActive ? "Deactivate" : "Activate"} reason: "${reason.reason_text.slice(0, 40)}..."`}
                              onVerified={() => handleToggle(reason)}
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
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add new reason form */}
      {showAddForm ? (
        <div className="rounded-xl border border-gray-100/50 dark:border-white/8 bg-white/50 dark:bg-white/3 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Add New Rejection Reason</h4>
            <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new-doc-type" className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Document Type <span className="text-red-500">*</span>
              </Label>
              <select
                id="new-doc-type"
                value={newDocType}
                onChange={(e) => setNewDocType(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-transparent px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
              >
                <option value="">Select document type...</option>
                {[
                  "guardian_photo",
                  "student_photo",
                  "national_id_front",
                  "national_id_back",
                  "birth_certificate",
                  "grade_certificate",
                  "grade_6_exam_cert",
                  "grade_8_exam_cert",
                ].map((dt) => (
                  <option key={dt} value={dt}>
                    {docTypeLabel(dt)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-reason-text" className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Reason Text <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
                <Input
                  id="new-reason-text"
                  value={newReasonText}
                  onChange={(e) => setNewReasonText(e.target.value)}
                  placeholder="e.g. Document is expired"
                  maxLength={500}
                  className="pl-9 rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
                />
              </div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 text-right">
                {newReasonText.length}/500 characters
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
                setNewDocType("")
                setNewReasonText("")
                setAddError(null)
              }}
              disabled={adding}
              className="rounded-xl border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5"
            >
              Cancel
            </Button>
            <SensitiveActionModal
              actionDescription={`Add rejection reason for ${docTypeLabel(newDocType)}: "${newReasonText.slice(0, 50)}"`}
              onVerified={handleAdd}
              disabled={adding || !newDocType || newReasonText.trim().length < 5}
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
                  Add Reason
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
            Add New Rejection Reason
          </span>
        </Button>
      )}

      {/* Info note */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-900/5 border border-blue-100/50 dark:border-blue-800/20">
        <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-xs font-medium text-blue-700 dark:text-blue-400">How Rejection Reasons Work</p>
          <p className="text-xs text-blue-600/80 dark:text-blue-400/80 leading-relaxed mt-0.5">
            Branch Admins select these reasons when rejecting documents. Deactivated reasons no longer appear
            in the review UI but are preserved on historical rejections. Each reason is tied to a specific
            document type.
          </p>
        </div>
      </div>
    </div>
  )
}