// components/admin/branch-admin-manager.tsx
// Redesigned branch admin management UI with modern styling

"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import SensitiveActionModal from "@/components/admin/sensitive-action-modal"

interface Branch {
  id: string
  name: string
  code: string
}

interface AdminMfa {
  is_configured: boolean
  last_verified_at: string | null
  locked_until: string | null
}

interface AdminProfile {
  id: string
  full_name: string
  is_active: boolean
  assigned_branch_id: string | null
  branches: {
    id: string
    name: string
    code: string
  } | null
}

interface BranchAdmin {
  id: string
  email: string
  full_name: string | null
  status: string
  created_at: string
  admin_profiles: AdminProfile | null
  admin_mfa: AdminMfa | null
}

export default function BranchAdminManager() {
  const [admins, setAdmins] = useState<BranchAdmin[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  const [newEmail, setNewEmail] = useState("")
  const [newFullName, setNewFullName] = useState("")
  const [newBranchId, setNewBranchId] = useState("")
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const [reassignBranchId, setReassignBranchId] = useState<Record<string, string>>({})
  const [deactivateReason, setDeactivateReason] = useState<Record<string, string>>({})
  const [reactivateBranchId, setReactivateBranchId] = useState<Record<string, string>>({})
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({})

  const fetchAdmins = useCallback(async () => {
    try {
      const response = await fetch("/api/master/branch-admins")
      if (!response.ok) {
        setError("Could not load branch admins")
        return
      }
      const data = await response.json()
      setAdmins(data.admins ?? [])
      setBranches(data.branches ?? [])
    } catch {
      setError("Could not load branch admins")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAdmins()
  }, [fetchAdmins])

  async function handleAction(
    adminId: string,
    action: "reassign" | "deactivate" | "reactivate"
  ) {
    setError(null)
    setSuccessMessage(null)
    setActionErrors((prev) => ({ ...prev, [adminId]: "" }))

    let bodyPayload: Record<string, unknown> = { action }

    if (action === "reassign") {
      const branchId = reassignBranchId[adminId]
      if (!branchId) {
        setActionErrors((prev) => ({
          ...prev,
          [adminId]: "Select a branch to reassign to",
        }))
        return
      }
      bodyPayload = { action, branchId }
    }

    if (action === "deactivate") {
      const reason = deactivateReason[adminId] ?? ""
      if (reason.trim().length < 10) {
        setActionErrors((prev) => ({
          ...prev,
          [adminId]: "Reason must be at least 10 characters",
        }))
        return
      }
      bodyPayload = { action, reason: reason.trim() }
    }

    if (action === "reactivate") {
      const branchId = reactivateBranchId[adminId]
      if (!branchId) {
        setActionErrors((prev) => ({
          ...prev,
          [adminId]: "Select a branch to assign",
        }))
        return
      }
      bodyPayload = { action, branchId }
    }

    setProcessingId(adminId)

    try {
      const response = await fetch(`/api/master/branch-admins/${adminId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      })

      const data = await response.json()

      if (!response.ok) {
        setActionErrors((prev) => ({
          ...prev,
          [adminId]: data.error ?? "Action failed",
        }))
        return
      }

      const actionLabels: Record<string, string> = {
        reassign: "reassigned",
        deactivate: "deactivated",
        reactivate: "reactivated",
      }

      setSuccessMessage(`Admin account ${actionLabels[action] ?? "updated"} successfully.`)
      await fetchAdmins()
    } catch {
      setActionErrors((prev) => ({
        ...prev,
        [adminId]: "Action failed. Please try again.",
      }))
    } finally {
      setProcessingId(null)
    }
  }

  async function handleAdd() {
    setAddError(null)

    if (!newEmail || !newEmail.includes("@")) {
      setAddError("Valid email is required")
      return
    }
    if (newFullName.trim().length < 2) {
      setAddError("Full name must be at least 2 characters")
      return
    }
    if (!newBranchId) {
      setAddError("Select a branch")
      return
    }

    setAdding(true)

    try {
      const response = await fetch("/api/master/branch-admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail.trim().toLowerCase(),
          fullName: newFullName.trim(),
          branchId: newBranchId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setAddError(data.error ?? "Could not assign Branch Admin")
        return
      }

      setSuccessMessage(`${newFullName} assigned as Branch Admin successfully.`)
      setNewEmail("")
      setNewFullName("")
      setNewBranchId("")
      setShowAddForm(false)
      await fetchAdmins()
    } catch {
      setAddError("Could not assign Branch Admin. Please try again.")
    } finally {
      setAdding(false)
    }
  }

  function getBranchName(profile: AdminProfile | null): string {
    if (!profile) return "Unassigned"
    if (!profile.branches) return "Unassigned"
    if (Array.isArray(profile.branches)) {
      return profile.branches[0]?.name ?? "Unassigned"
    }
    return profile.branches.name ?? "Unassigned"
  }

  function getAdminProfile(admin: BranchAdmin): AdminProfile | null {
    return admin.admin_profiles ?? null
  }

  function getAdminMfa(admin: BranchAdmin): AdminMfa | null {
    return admin.admin_mfa ?? null
  }

  const activeAdmins = admins.filter((a) => a.status === "ACTIVE")
  const inactiveAdmins = admins.filter((a) => a.status === "DEACTIVATED")

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full border-4 border-[#6c63ff]/20 border-t-[#6c63ff] animate-spin" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading branch admins...</p>
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

  return (
    <div className="space-y-8">
      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-linear-to-br from-[#6c63ff]/10 to-[#8b83ff]/10 border border-[#6c63ff]/20 p-4 text-center">
          <p className="text-2xl font-bold text-[#6c63ff] dark:text-[#9d97ff]">{admins.length}</p>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Total Admins</p>
        </div>
        <div className="rounded-xl bg-linear-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-200/50 dark:border-emerald-800/30 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{activeAdmins.length}</p>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Active</p>
        </div>
        <div className="rounded-xl bg-linear-to-br from-gray-500/10 to-gray-600/10 border border-gray-200/50 dark:border-white/10 p-4 text-center">
          <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{inactiveAdmins.length}</p>
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

      {/* Active admins */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Active Branch Admins</h3>
          <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30">
            {activeAdmins.length}
          </span>
          <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
        </div>

        {activeAdmins.length === 0 ? (
          <div className="flex flex-col items-center py-8 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl">
            <svg className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <p className="text-sm text-gray-500 dark:text-gray-400">No active Branch Admins</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Assign one below</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeAdmins.map((admin) => {
              const profile = getAdminProfile(admin)
              const mfa = getAdminMfa(admin)
              const actionError = actionErrors[admin.id]
              const isLocked = mfa?.locked_until && new Date(mfa.locked_until) > new Date()

              return (
                <div
                  key={admin.id}
                  className="group rounded-xl border border-gray-100/50 dark:border-white/8 bg-white/50 dark:bg-white/3 p-5 transition-all duration-200 hover:shadow-md"
                >
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    {/* Admin info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-linear-to-br from-[#6c63ff]/10 to-[#8b83ff]/10 flex items-center justify-center border border-[#6c63ff]/20">
                          <span className="text-sm font-bold text-[#6c63ff]">
                            {profile?.full_name?.charAt(0).toUpperCase() || admin.email?.charAt(0).toUpperCase() || "?"}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {profile?.full_name ?? admin.full_name ?? admin.email}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{admin.email}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {getBranchName(profile)}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium ${
                          mfa?.is_configured
                            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30"
                            : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/30"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${mfa?.is_configured ? "bg-emerald-500" : "bg-amber-500"}`} />
                          MFA: {mfa?.is_configured ? "✓ Configured" : "Not set up"}
                        </span>
                        {isLocked && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200/50 dark:border-red-800/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            Locked
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Active
                    </span>
                  </div>

                  {actionError && (
                    <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-red-50/80 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20">
                      <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-red-600 dark:text-red-400">{actionError}</p>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-gray-100/50 dark:border-white/5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Reassign branch */}
                      <div className="space-y-2">
                        <Label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Reassign to Branch
                        </Label>
                        <select
                          value={reassignBranchId[admin.id] ?? ""}
                          onChange={(e) =>
                            setReassignBranchId((prev) => ({
                              ...prev,
                              [admin.id]: e.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-transparent px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
                        >
                          <option value="">Select branch...</option>
                          {branches
                            .filter((b) => b.id !== profile?.assigned_branch_id)
                            .map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}
                              </option>
                            ))}
                        </select>
                        <SensitiveActionModal
                          actionDescription={`Reassign ${profile?.full_name ?? admin.email} to a different branch`}
                          onVerified={() => handleAction(admin.id, "reassign")}
                          variant="outline"
                          disabled={processingId === admin.id}
                        >
                          {processingId === admin.id ? (
                            <span className="flex items-center gap-2">
                              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                              </svg>
                              Processing...
                            </span>
                          ) : (
                            <span className="flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                              </svg>
                              Reassign
                            </span>
                          )}
                        </SensitiveActionModal>
                      </div>

                      {/* Deactivate */}
                      <div className="space-y-2">
                        <Label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Reason for Deactivation
                        </Label>
                        <Textarea
                          value={deactivateReason[admin.id] ?? ""}
                          onChange={(e) =>
                            setDeactivateReason((prev) => ({
                              ...prev,
                              [admin.id]: e.target.value,
                            }))
                          }
                          placeholder="Enter reason..."
                          rows={2}
                          maxLength={500}
                          className="rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20 resize-none"
                        />
                        <SensitiveActionModal
                          actionDescription={`Deactivate Branch Admin: ${profile?.full_name ?? admin.email}`}
                          onVerified={() => handleAction(admin.id, "deactivate")}
                          variant="destructive"
                          disabled={processingId === admin.id}
                        >
                          {processingId === admin.id ? (
                            <span className="flex items-center gap-2">
                              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                              </svg>
                              Processing...
                            </span>
                          ) : (
                            <span className="flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
                              </svg>
                              Deactivate
                            </span>
                          )}
                        </SensitiveActionModal>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add new branch admin */}
      {showAddForm ? (
        <div className="rounded-xl border border-gray-100/50 dark:border-white/8 bg-white/50 dark:bg-white/3 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Assign Branch Admin</h3>
            <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-800/20">
            <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              The person must have signed in with Google at least once.
              Their role will be changed from Guardian to Branch Admin.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email" className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Google Account Email <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <Input
                  id="admin-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="admin@gmail.com"
                  maxLength={200}
                  className="pl-9 rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-name" className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <Input
                  id="admin-name"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="Enter full name"
                  maxLength={100}
                  className="pl-9 rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-branch" className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Assign to Branch <span className="text-red-500">*</span>
            </Label>
            <select
              id="admin-branch"
              value={newBranchId}
              onChange={(e) => setNewBranchId(e.target.value)}
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
                setNewEmail("")
                setNewFullName("")
                setNewBranchId("")
                setAddError(null)
              }}
              disabled={adding}
              className="rounded-xl border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5"
            >
              Cancel
            </Button>
            <SensitiveActionModal
              actionDescription={`Assign ${newFullName || newEmail} as Branch Admin for ${branches.find((b) => b.id === newBranchId)?.name ?? "selected branch"}`}
              onVerified={handleAdd}
              disabled={adding || !newEmail || !newFullName || !newBranchId}
            >
              {adding ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                  </svg>
                  Assigning...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Assign as Branch Admin
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
            Assign Branch Admin
          </span>
        </Button>
      )}

      {/* Inactive admins */}
      {inactiveAdmins.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400">Deactivated Admins</h3>
            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-500/10 text-gray-500 border border-gray-200/50 dark:border-white/10">
              {inactiveAdmins.length}
            </span>
            <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
          </div>

          <div className="space-y-3">
            {inactiveAdmins.map((admin) => {
              const profile = getAdminProfile(admin)
              const actionError = actionErrors[admin.id]

              return (
                <div
                  key={admin.id}
                  className="group rounded-xl border border-gray-200/50 dark:border-white/5 bg-gray-50/30 dark:bg-white/3 p-5 opacity-60 transition-all duration-200 hover:opacity-100 hover:shadow-md"
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-white/10 flex items-center justify-center">
                          <span className="text-sm font-bold text-gray-500">
                            {profile?.full_name?.charAt(0).toUpperCase() || admin.email?.charAt(0).toUpperCase() || "?"}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                            {profile?.full_name ?? admin.full_name ?? admin.email}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500">{admin.email}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            Previous branch: {getBranchName(profile)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 border border-gray-200/50 dark:border-white/10 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                      Deactivated
                    </span>
                  </div>

                  {actionError && (
                    <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-red-50/80 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20">
                      <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-red-600 dark:text-red-400">{actionError}</p>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-white/5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1">
                        <Label className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                          Reactivate — assign to branch
                        </Label>
                        <select
                          value={reactivateBranchId[admin.id] ?? ""}
                          onChange={(e) =>
                            setReactivateBranchId((prev) => ({
                              ...prev,
                              [admin.id]: e.target.value,
                            }))
                          }
                          className="w-full mt-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-transparent px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
                        >
                          <option value="">Select branch...</option>
                          {branches.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <SensitiveActionModal
                        actionDescription={`Reactivate Branch Admin: ${profile?.full_name ?? admin.email}`}
                        onVerified={() => handleAction(admin.id, "reactivate")}
                        variant="outline"
                        disabled={processingId === admin.id}
                      >
                        {processingId === admin.id ? (
                          <span className="flex items-center gap-2">
                            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                            </svg>
                            Processing...
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Reactivate
                          </span>
                        )}
                      </SensitiveActionModal>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}