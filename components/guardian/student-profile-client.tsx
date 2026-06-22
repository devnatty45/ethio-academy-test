// components/guardian/student-profile-client.tsx
// Redesigned Co-guardian management section with modern UI

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ActiveCoGuardian {
  id: string
  user: { full_name: string | null; email: string } | null
}

interface PendingInvite {
  id: string
  invitedPhone: string
  expiresAt: string
}

interface StudentProfileClientProps {
  studentId: string
  isPrimary: boolean
  activeCoGuardian: ActiveCoGuardian | null
  pendingInvite: PendingInvite | null
}

export default function StudentProfileClient({
  studentId,
  isPrimary,
  activeCoGuardian,
  pendingInvite,
}: StudentProfileClientProps) {
  const router = useRouter()
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [phone, setPhone] = useState("")
  const [sending, setSending] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSending(true)

    try {
      const response = await fetch(
        `/api/guardian/students/${studentId}/invite-co-guardian`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? "Could not send invitation")
        return
      }

      setSuccess("Invitation sent successfully. Valid for 48 hours.")
      setShowInviteForm(false)
      setPhone("")
      router.refresh()
    } catch {
      setError("Could not send invitation. Please try again.")
    } finally {
      setSending(false)
    }
  }

  async function handleRevoke() {
    setError(null)
    setRevoking(true)

    try {
      const response = await fetch(
        `/api/guardian/students/${studentId}/co-guardian`,
        { method: "DELETE" }
      )

      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? "Could not revoke co-guardian")
        return
      }

      setSuccess("Co-guardian access revoked successfully.")
      router.refresh()
    } catch {
      setError("Could not revoke. Please try again.")
    } finally {
      setRevoking(false)
    }
  }

  if (!isPrimary) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-gray-200/50 dark:border-white/10">
        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Co-Guardian Management</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Only primary guardians can manage co-guardians.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Co-Guardian Management</h3>
        <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
      </div>

      {error && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50/80 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20">
          <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-900/10 border border-emerald-200/50 dark:border-emerald-800/20">
          <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>
        </div>
      )}

      <div className="rounded-xl bg-gray-50/50 dark:bg-white/5 border border-gray-100/50 dark:border-white/5 p-4 space-y-4">
        {activeCoGuardian ? (
          // Active co-guardian
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-200/50 dark:border-emerald-800/30">
                <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-white">
                  {activeCoGuardian.user?.full_name ?? activeCoGuardian.user?.email ?? "Co-guardian"}
                </p>
                {activeCoGuardian.user?.email && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">{activeCoGuardian.user.email}</p>
                )}
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full mt-1">
                  <span className="w-1 h-1 rounded-full bg-emerald-500" />
                  Active
                </span>
              </div>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRevoke}
              disabled={revoking}
              className="rounded-lg"
            >
              {revoking ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                  </svg>
                  Revoking...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
                  </svg>
                  Revoke Access
                </span>
              )}
            </Button>
          </div>
        ) : pendingInvite ? (
          // Pending invite
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 border border-amber-200/50 dark:border-amber-800/30">
                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-white">
                  Invitation Pending
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {pendingInvite.invitedPhone}
                </p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                  Expires {new Date(pendingInvite.expiresAt).toLocaleString()}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowInviteForm(true)
                setSuccess(null)
                setError(null)
              }}
              className="rounded-lg"
            >
              Send New
            </Button>
          </div>
        ) : showInviteForm ? (
          // Invite form
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="co-guardian-phone" className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Co-Guardian Phone Number
              </Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <Input
                  id="co-guardian-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="09XXXXXXXX"
                  required
                  className="pl-9 rounded-xl border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
                />
              </div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">
                The co-guardian will receive an SMS invitation to join.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                size="sm"
                disabled={sending || !phone}
                className="bg-[#6c63ff] hover:bg-[#5a52e0] text-white rounded-lg"
              >
                {sending ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                    </svg>
                    Sending...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Send Invitation
                  </span>
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowInviteForm(false)
                  setPhone("")
                  setError(null)
                }}
                disabled={sending}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          // No co-guardian
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center shrink-0 border border-gray-200/50 dark:border-white/10">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No Co-Guardian Assigned</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  Invite a co-guardian to help manage this student.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowInviteForm(true)
                setSuccess(null)
                setError(null)
              }}
              className="rounded-lg border-[#6c63ff]/30 text-[#6c63ff] hover:bg-[#6c63ff]/10 hover:border-[#6c63ff]"
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Invite
              </span>
            </Button>
          </div>
        )}
      </div>

      {/* Help text */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-900/5 border border-blue-100/50 dark:border-blue-800/20">
        <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs text-blue-600/80 dark:text-blue-400/80">
          Co-guardians can help manage enrollments and view student information. Invitations expire after 48 hours.
        </p>
      </div>
    </div>
  )
}