// components/admin/transfer-initiate-form.tsx
// Redesigned transfer initiate form with modern UI

"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface Branch {
  id: string
  name: string
}

interface TransferInitiateFormProps {
  enrollmentId: string
  currentBranchId: string
  onSuccess: () => void
}

export default function TransferInitiateForm({
  enrollmentId,
  currentBranchId,
  onSuccess,
}: TransferInitiateFormProps) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [toBranchId, setToBranchId] = useState("")
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchBranches() {
      const response = await fetch("/api/master/branches")
      const data = await response.json()
      setBranches(
        (data.branches ?? []).filter(
          (b: Branch) => b.id !== currentBranchId
        )
      )
    }
    fetchBranches()
  }, [currentBranchId])

  async function handleSubmit() {
    setError(null)
    if (!toBranchId) {
      setError("Select a target branch")
      return
    }
    if (reason.trim().length < 20) {
      setError("Reason must be at least 20 characters")
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(
        `/api/admin/branch/enrollments/${enrollmentId}/transfer/initiate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toBranchId,
            reason: reason.trim(),
          }),
        }
      )
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? "Could not initiate transfer")
        return
      }
      onSuccess()
    } catch {
      setError("Could not initiate transfer. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Initiate Transfer</h4>
        <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50/80 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20">
          <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Target Branch</label>
          <select
            value={toBranchId}
            onChange={(e) => setToBranchId(e.target.value)}
            className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-transparent px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
          >
            <option value="">Select target branch...</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Reason for Transfer <span className="text-gray-400">(minimum 20 characters)</span>
          </label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this enrollment should be transferred..."
            rows={3}
            maxLength={500}
            className="rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20 resize-none"
          />
          <div className="flex justify-between">
            <p className="text-[10px] text-gray-400 dark:text-gray-500">
              {reason.length}/500 characters
            </p>
            {reason.length > 0 && reason.length < 20 && (
              <p className="text-[10px] text-red-400">
                {20 - reason.length} more characters needed
              </p>
            )}
          </div>
        </div>

        <Button
          className="w-full bg-linear-to-r from-[#6c63ff] to-[#7c73ff] hover:from-[#5a52e0] hover:to-[#6c63ff] text-white rounded-xl py-2.5 font-semibold transition-all duration-300 shadow-lg shadow-[#6c63ff]/25 hover:shadow-[#6c63ff]/40 disabled:opacity-50"
          onClick={handleSubmit}
          disabled={submitting || !toBranchId || reason.length < 20}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
              </svg>
              Initiating Transfer...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Initiate Transfer
            </span>
          )}
        </Button>
      </div>

      <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-900/5 border border-blue-100/50 dark:border-blue-800/20">
        <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs text-blue-600 dark:text-blue-400">
          Transfer requests require approval from the target branch admin.
        </p>
      </div>
    </div>
  )
}