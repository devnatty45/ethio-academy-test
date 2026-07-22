// components/admin/teacher-approval-queue.tsx
// Purpose: Client component — list branch teachers by status, search by email
// across branches, approve/suspend/reactivate
"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
  searchTeacherByEmail,
  approveTeacher,
  suspendTeacher,
  reactivateTeacher,
} from "@/app/dashboard/branch/teachers/actions"

type TeacherRow = {
  id: string
  full_name: string
  phone: string | null
  status: string
  created_at: string
  user_id: string
  users: { email: string } | { email: string }[] | null
}

type Branch = { id: string; name: string }

function getEmail(row: TeacherRow) {
  if (Array.isArray(row.users)) return row.users[0]?.email ?? "—"
  return row.users?.email ?? "—"
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING_APPROVAL: "bg-[#f5a623]/15 text-[#b3760c]",
    ACTIVE: "bg-emerald-100 text-emerald-700",
    SUSPENDED: "bg-red-100 text-red-700",
  }
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${styles[status] ?? ""}`}>
      {status.replace("_", " ")}
    </span>
  )
}

export default function TeacherApprovalQueue({
  initialTeachers,
  branches,
  currentBranchId,
}: {
  initialTeachers: TeacherRow[]
  branches: Branch[]
  currentBranchId: string
}) {
  const [tab, setTab] = useState<"pending" | "active" | "suspended">("pending")
  const [searchEmail, setSearchEmail] = useState("")
  const [searchResults, setSearchResults] = useState<any[] | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [branchChoice, setBranchChoice] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

  const filtered = initialTeachers.filter((t) => {
    if (tab === "pending") return t.status === "PENDING_APPROVAL"
    if (tab === "active") return t.status === "ACTIVE"
    return t.status === "SUSPENDED"
  })

  function handleSearch() {
    setSearchError(null)
    startTransition(async () => {
      const res = await searchTeacherByEmail(searchEmail)
      if (res.error) setSearchError(res.error)
      else setSearchResults(res.results ?? [])
    })
  }

  function handleApprove(teacherProfileId: string, fallbackBranchId: string) {
    const branchId = branchChoice[teacherProfileId] ?? fallbackBranchId
    startTransition(async () => {
      await approveTeacher(teacherProfileId, branchId)
      setSearchResults(null)
      setSearchEmail("")
    })
  }

  function handleSuspend(id: string) {
    startTransition(async () => {
      await suspendTeacher(id)
    })
  }

  function handleReactivate(id: string) {
    startTransition(async () => {
      await reactivateTeacher(id)
    })
  }

  return (
    <div className="space-y-6">
      {/* Email search across all branches */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Search teacher by email
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            placeholder="teacher@gmail.com"
            className="flex-1 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-sm text-gray-900 dark:text-white"
          />
          <Button onClick={handleSearch} disabled={isPending || !searchEmail}>
            Search
          </Button>
        </div>
        {searchError && (
          <p className="text-xs text-red-600 mt-2">{searchError}</p>
        )}
        {searchResults && (
          <div className="mt-4 space-y-3">
            {searchResults.length === 0 && (
              <p className="text-sm text-gray-400">No teacher found with that email.</p>
            )}
            {searchResults.map((r) => {
              const profile = Array.isArray(r.teacher_profiles)
                ? r.teacher_profiles[0]
                : r.teacher_profiles
              if (!profile) return null
              const currentBranchName = Array.isArray(profile.branches)
                ? profile.branches[0]?.name
                : profile.branches?.name

              return (
                <div
                  key={r.id}
                  className="border border-gray-100 dark:border-white/10 rounded-xl p-4 flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {profile.full_name} — {r.email}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Requested branch: {currentBranchName} · <StatusBadge status={profile.status} />
                    </p>
                  </div>
                  {profile.status === "PENDING_APPROVAL" && (
                    <div className="flex items-center gap-2">
                      <select
                        defaultValue={profile.branch_id}
                        onChange={(e) =>
                          setBranchChoice((prev) => ({ ...prev, [profile.id]: e.target.value }))
                        }
                        className="text-sm rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-2 py-1.5"
                      >
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleApprove(profile.id, profile.branch_id)}
                      >
                        Approve
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Tabs for own branch */}
      <div>
        <div className="flex gap-2 border-b border-gray-100 dark:border-white/10 mb-4">
          {(["pending", "active", "suspended"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
                tab === t
                  ? "border-[#6c63ff] text-[#6c63ff]"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">
            No teachers in this category.
          </p>
        ) : (
          <div className="space-y-3">
            {filtered.map((t) => (
              <div
                key={t.id}
                className="border border-gray-100 dark:border-white/10 rounded-xl p-4 flex items-center justify-between gap-4"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {t.full_name} — {getEmail(t)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {t.phone ?? "No phone"} · <StatusBadge status={t.status} />
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {t.status === "PENDING_APPROVAL" && (
                    <Button
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleApprove(t.id, currentBranchId)}
                    >
                      Approve
                    </Button>
                  )}
                  {t.status === "ACTIVE" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50"
                      disabled={isPending}
                      onClick={() => handleSuspend(t.id)}
                    >
                      Suspend
                    </Button>
                  )}
                  {t.status === "SUSPENDED" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isPending}
                      onClick={() => handleReactivate(t.id)}
                    >
                      Reactivate
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
