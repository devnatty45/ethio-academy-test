// components/admin/branch-management.tsx
// Redesigned branch management UI with modern styling

"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import SensitiveActionModal from "@/components/admin/sensitive-action-modal"

interface Branch {
  id: string
  name: string
  code: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function BranchManagement() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [reasonErrors, setReasonErrors] = useState<Record<string, string>>({})
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const fetchBranches = useCallback(async () => {
    try {
      const response = await fetch("/api/master/branches")
      if (!response.ok) {
        setError("Could not load branches")
        return
      }
      const data = await response.json()
      setBranches(data.branches ?? [])
    } catch {
      setError("Could not load branches")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBranches()
  }, [fetchBranches])

  async function handleToggle(branch: Branch, newIsActive: boolean) {
    setError(null)
    setSuccessMessage(null)

    const reason = reasons[branch.id] ?? ""
    if (reason.trim().length < 10) {
      setReasonErrors((prev) => ({
        ...prev,
        [branch.id]: "Reason must be at least 10 characters",
      }))
      return
    }

    setProcessingId(branch.id)

    try {
      const response = await fetch(`/api/master/branches/${branch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isActive: newIsActive,
          reason: reason.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? "Could not update branch")
        return
      }

      setSuccessMessage(
        `${branch.name} has been ${newIsActive ? "activated" : "deactivated"}.`
      )
      setReasons((prev) => ({ ...prev, [branch.id]: "" }))
      setReasonErrors((prev) => ({ ...prev, [branch.id]: "" }))
      await fetchBranches()
    } catch {
      setError("Could not update branch. Please try again.")
    } finally {
      setProcessingId(null)
    }
  }

  // Count active and inactive branches
  const activeCount = branches.filter((b) => b.is_active).length
  const inactiveCount = branches.filter((b) => !b.is_active).length

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full border-4 border-[#6c63ff]/20 border-t-[#6c63ff] animate-spin" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading branches...</p>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-gray-100/50 dark:border-white/5">
                <div className="space-y-2">
                  <div className="h-4 w-32 rounded bg-gray-200 dark:bg-white/10" />
                  <div className="h-3 w-20 rounded bg-gray-200 dark:bg-white/10" />
                </div>
                <div className="h-6 w-16 rounded bg-gray-200 dark:bg-white/10" />
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
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-linear-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-200/50 dark:border-emerald-800/30 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{activeCount}</p>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Active Branches</p>
        </div>
        <div className="rounded-xl bg-linear-to-br from-gray-500/10 to-gray-600/10 border border-gray-200/50 dark:border-white/10 p-4 text-center">
          <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{inactiveCount}</p>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Inactive Branches</p>
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

      {/* Branch list */}
      <div className="space-y-3">
        {branches.map((branch) => {
          const isActive = branch.is_active
          const isProcessing = processingId === branch.id
          const reason = reasons[branch.id] ?? ""
          const reasonError = reasonErrors[branch.id]

          return (
            <div
              key={branch.id}
              className={`group rounded-xl border p-5 transition-all duration-200 hover:shadow-md ${
                isActive
                  ? "border-gray-100/50 dark:border-white/8 bg-white dark:bg-white/3"
                  : "border-gray-200/50 dark:border-white/5 bg-gray-50/50 dark:bg-white/3"
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-start gap-4">
                {/* Branch info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isActive
                        ? "bg-emerald-500/10 border border-emerald-200/50 dark:border-emerald-800/30"
                        : "bg-gray-100 dark:bg-white/5 border border-gray-200/50 dark:border-white/10"
                    }`}>
                      <span className="text-lg">{isActive ? "🏢" : "🏚️"}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {branch.name}
                      </p>
                      <p className="text-xs font-mono text-gray-400 dark:text-gray-500">
                        Code: {branch.code}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Status badge */}
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                    isActive
                      ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30"
                      : "bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 border border-gray-200/50 dark:border-white/10"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      isActive ? "bg-emerald-500" : "bg-gray-400"
                    }`} />
                    {isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>

              {/* Reason input */}
              <div className="mt-4 pt-4 border-t border-gray-100/50 dark:border-white/5">
                <div className="space-y-2">
                  <Label htmlFor={`reason-${branch.id}`} className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Reason for {isActive ? "deactivating" : "activating"} this branch
                    <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <Input
                      id={`reason-${branch.id}`}
                      value={reason}
                      onChange={(e) => {
                        setReasons((prev) => ({
                          ...prev,
                          [branch.id]: e.target.value,
                        }))
                        setReasonErrors((prev) => ({
                          ...prev,
                          [branch.id]: "",
                        }))
                      }}
                      placeholder={`Enter reason for ${isActive ? "deactivating" : "activating"} this branch`}
                      maxLength={500}
                      className={`pl-9 rounded-lg ${
                        reasonError
                          ? "border-red-300 dark:border-red-800 focus:ring-red-500/20"
                          : "border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
                      }`}
                    />
                  </div>
                  {reasonError && (
                    <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {reasonError}
                    </p>
                  )}
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">
                    {reason.length}/500 characters {reason.length > 0 && reason.length < 10 && `(${10 - reason.length} more needed)`}
                  </p>
                </div>
              </div>

              {/* Action button */}
              <div className="mt-4 pt-4 border-t border-gray-100/50 dark:border-white/5">
                <SensitiveActionModal
                  actionDescription={`${isActive ? "Deactivate" : "Activate"} branch: ${branch.name}`}
                  onVerified={() => handleToggle(branch, !isActive)}
                  variant={isActive ? "destructive" : "default"}
                  disabled={isProcessing || reason.length < 10}
                >
                  {isProcessing ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                      </svg>
                      Processing...
                    </span>
                  ) : isActive ? (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
                      </svg>
                      Deactivate Branch
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Activate Branch
                    </span>
                  )}
                </SensitiveActionModal>
              </div>
            </div>
          )
        })}
      </div>

      {/* Empty state */}
      {branches.length === 0 && (
        <div className="flex flex-col items-center py-12 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
          <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">No branches found</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Contact your administrator to add branches</p>
        </div>
      )}
    </div>
  )
}