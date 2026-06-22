// components/admin/locked-accounts.tsx
// Locked admin accounts viewer and unlock tool
// Used on Master Admin dashboard
// Client component — fetches and displays locked accounts

"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import SensitiveActionModal from "@/components/admin/sensitive-action-modal"

interface LockedAdmin {
  admin_id: string
  failed_attempts: number
  locked_until: string
  last_verified_at: string | null
  users: {
    id: string
    email: string
    full_name: string | null
    role: string
  }
}

export default function LockedAccounts() {
  const [lockedAdmins, setLockedAdmins] = useState<LockedAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [unlockingId, setUnlockingId] = useState<string | null>(null)
  const [reason, setReason] = useState("")
  const [reasonError, setReasonError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const fetchLockedAdmins = useCallback(async () => {
    try {
      const response = await fetch("/api/master/admins/locked")
      if (!response.ok) return
      const data = await response.json()
      setLockedAdmins(data.lockedAdmins ?? [])
    } catch {
      // Silently fail — this is a secondary dashboard widget
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLockedAdmins()
    // Refresh every 30 seconds
    const interval = setInterval(fetchLockedAdmins, 30000)
    return () => clearInterval(interval)
  }, [fetchLockedAdmins])

  async function handleUnlock(adminId: string) {
    setReasonError(null)
    setSuccessMessage(null)

    if (reason.trim().length < 10) {
      setReasonError("Reason must be at least 10 characters")
      return
    }

    setUnlockingId(adminId)

    try {
      const response = await fetch("/api/master/admins/locked", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId, reason: reason.trim() }),
      })

      if (!response.ok) {
        const data = await response.json()
        setReasonError(data.error ?? "Could not unlock account")
        return
      }

      const admin = lockedAdmins.find((a) => a.admin_id === adminId)
      setSuccessMessage(
        `${admin?.users.full_name ?? admin?.users.email ?? "Account"} has been unlocked.`
      )
      setReason("")
      await fetchLockedAdmins()
    } catch {
      setReasonError("Could not unlock account. Please try again.")
    } finally {
      setUnlockingId(null)
    }
  }

  function formatLockedUntil(lockedUntil: string): string {
    const date = new Date(lockedUntil)
    const minutesLeft = Math.ceil((date.getTime() - Date.now()) / 60000)
    if (minutesLeft <= 0) return "Expires soon"
    return `${minutesLeft} minute${minutesLeft === 1 ? "" : "s"} remaining`
  }

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">
        Checking for locked accounts...
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">
          Locked Admin Accounts
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchLockedAdmins}
        >
          Refresh
        </Button>
      </div>

      {successMessage && (
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
          <p className="text-sm text-foreground">✓ {successMessage}</p>
        </div>
      )}

      {lockedAdmins.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No admin accounts are currently locked.
        </p>
      ) : (
        <div className="space-y-3">
          {lockedAdmins.map((admin) => (
            <div
              key={admin.admin_id}
              className="rounded-md border border-border p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">
                    {admin.users.full_name ?? admin.users.email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {admin.users.email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Role: {admin.users.role.replace("_", " ")}
                  </p>
                </div>
                <div className="text-right space-y-0.5">
                  <p className="text-xs font-medium text-destructive">
                    Locked
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatLockedUntil(admin.locked_until)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {admin.failed_attempts} failed attempt
                    {admin.failed_attempts === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`reason-${admin.admin_id}`}>
                  Reason for manual unlock
                </Label>
                <Input
                  id={`reason-${admin.admin_id}`}
                  value={unlockingId === admin.admin_id ? reason : reason}
                  onChange={(e) => {
                    setReason(e.target.value)
                    setReasonError(null)
                  }}
                  placeholder="Enter reason for unlocking this account"
                  maxLength={500}
                />
                {reasonError && unlockingId === admin.admin_id && (
                  <p className="text-xs text-destructive">{reasonError}</p>
                )}
              </div>

              <SensitiveActionModal
                actionDescription={`Manually unlock admin account: ${admin.users.email}`}
                onVerified={() => handleUnlock(admin.admin_id)}
                variant="outline"
                disabled={unlockingId === admin.admin_id}
              >
                {unlockingId === admin.admin_id
                  ? "Unlocking..."
                  : "Unlock Account"}
              </SensitiveActionModal>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}