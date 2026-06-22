// components/admin/system-health-client.tsx
// Redesigned system health client with modern UI

"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"

interface AcademicYear {
  id: string
  name: string
  status: string
}

interface SeatFillRate {
  branchName: string
  gradeName: string
  streamName: string | null
  totalSeats: number
  enrolledSeats: number
  reservedSeats: number
  pendingSeats: number
  available: number
  fillRate: number
}

interface FlaggedGuardian {
  guardianId: string
  guardianName: string
  guardianPhone: string
  studentStuId: string
  studentName: string
  expiredCount: number
}

interface LockedAdmin {
  id: string
  email: string
  full_name: string
  role: string
}

interface OverrideValue {
  status?: string
  reason?: string
  [key: string]: unknown
}

interface HealthData {
  generatedAt: string
  webhooks: {
    failuresLast24h: number
    totalLast24h: number
  }
  smsQueue: {
    failedLast7d: number
    pending: number
  }
  paymentClaims: {
    pendingCount: number
    oldestPendingAt: string | null
  }
  billingCounter: {
    totalEnrolled: number
    lastUpdatedAt: string | null
  }
  seatFillRates: SeatFillRate[]
  flaggedGuardians: FlaggedGuardian[]
  lockedAdmins: LockedAdmin[]
  recentOverrides: {
    id: string
    action_type: string
    created_at: string
    new_value: unknown
  }[]
}

function StatCard({
  label,
  value,
  sublabel,
  variant = "default",
  icon,
}: {
  label: string
  value: string | number
  sublabel?: string
  variant?: "default" | "warning" | "danger" | "success"
  icon?: React.ReactNode
}) {
  const colorMap = {
    default: {
      bg: "bg-gradient-to-br from-[#6c63ff]/10 to-[#8b83ff]/10 border-[#6c63ff]/20",
      text: "text-[#6c63ff] dark:text-[#9d97ff]"
    },
    warning: {
      bg: "bg-gradient-to-br from-amber-500/10 to-amber-600/10 border-amber-200/50 dark:border-amber-800/30",
      text: "text-amber-600 dark:text-amber-400"
    },
    danger: {
      bg: "bg-gradient-to-br from-red-500/10 to-red-600/10 border-red-200/50 dark:border-red-800/30",
      text: "text-red-600 dark:text-red-400"
    },
    success: {
      bg: "bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border-emerald-200/50 dark:border-emerald-800/30",
      text: "text-emerald-600 dark:text-emerald-400"
    },
  }

  const colors = colorMap[variant]

  return (
    <div className={`rounded-xl border p-4 ${colors.bg} transition-all duration-200 hover:shadow-md`}>
      <div className="flex items-start justify-between">
        <div className="space-y-0.5">
          <p className={`text-2xl font-bold ${colors.text}`}>{value}</p>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">{label}</p>
          {sublabel && (
            <p className="text-[10px] text-gray-400 dark:text-gray-500">{sublabel}</p>
          )}
        </div>
        {icon && <div className="text-2xl opacity-50">{icon}</div>}
      </div>
    </div>
  )
}

export default function SystemHealthClient({
  years,
  defaultYearId,
}: {
  years: AcademicYear[]
  defaultYearId: string
}) {
  const [selectedYearId, setSelectedYearId] = useState(defaultYearId)
  const [data, setData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [unlockingId, setUnlockingId] = useState<string | null>(null)

  const fetchHealth = useCallback(async () => {
    setError(null)
    try {
      const params = new URLSearchParams()
      if (selectedYearId) params.set("academicYearId", selectedYearId)
      const response = await fetch(`/api/master/health?${params.toString()}`)
      const json = await response.json()
      if (!response.ok) {
        setError(json.error ?? "Could not load health data")
        return
      }
      setData(json)
    } catch {
      setError("Could not load health data")
    } finally {
      setLoading(false)
    }
  }, [selectedYearId])

  useEffect(() => {
    fetchHealth()
    const interval = setInterval(fetchHealth, 60000)
    return () => clearInterval(interval)
  }, [fetchHealth])

  async function handleUnlock(userId: string) {
    setUnlockingId(userId)
    try {
      const response = await fetch(`/api/master/admins/${userId}/unlock`, { method: "POST" })
      if (response.ok) {
        await fetchHealth()
      }
    } finally {
      setUnlockingId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full border-4 border-[#6c63ff]/20 border-t-[#6c63ff] animate-spin" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading system health data...</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="p-4 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-gray-100/50 dark:border-white/5">
                <div className="h-8 w-12 rounded bg-gray-200 dark:bg-white/10" />
                <div className="h-3 w-20 rounded bg-gray-200 dark:bg-white/10 mt-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50/80 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20">
        <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-sm font-medium text-red-700 dark:text-red-400">Error Loading Health Data</p>
          <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">{error ?? "Could not load health data"}</p>
        </div>
      </div>
    )
  }

  const webhookHealthy =
    data.webhooks.totalLast24h === 0 ||
    data.webhooks.failuresLast24h / data.webhooks.totalLast24h < 0.1

  return (
    <div className="space-y-8">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Academic Year:</label>
          <select
            value={selectedYearId}
            onChange={(e) => setSelectedYearId(e.target.value)}
            className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-transparent px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
          >
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name} ({y.status})
              </option>
            ))}
          </select>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchHealth}
          disabled={loading}
          className="rounded-lg border-[#6c63ff]/30 text-[#6c63ff] hover:bg-[#6c63ff]/10 hover:border-[#6c63ff] transition-all duration-200"
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </span>
        </Button>

        <p className="text-[10px] text-gray-400 dark:text-gray-500 ml-auto">
          Last updated: {new Date(data.generatedAt).toLocaleTimeString()}
        </p>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="Webhook Failures (24h)"
          value={data.webhooks.failuresLast24h}
          sublabel={`${data.webhooks.totalLast24h} total hits`}
          variant={data.webhooks.failuresLast24h === 0 ? "success" : webhookHealthy ? "warning" : "danger"}
          icon="🔌"
        />
        <StatCard
          label="SMS Failed (7d)"
          value={data.smsQueue.failedLast7d}
          sublabel={`${data.smsQueue.pending} pending`}
          variant={data.smsQueue.failedLast7d === 0 ? "success" : "warning"}
          icon="📱"
        />
        <StatCard
          label="Pending Payment Claims"
          value={data.paymentClaims.pendingCount}
          sublabel={
            data.paymentClaims.oldestPendingAt
              ? `Oldest: ${new Date(data.paymentClaims.oldestPendingAt).toLocaleDateString()}`
              : undefined
          }
          variant={
            data.paymentClaims.pendingCount === 0
              ? "success"
              : data.paymentClaims.pendingCount > 5
              ? "danger"
              : "warning"
          }
          icon="💳"
        />
        <StatCard
          label="Total Enrolled"
          value={data.billingCounter.totalEnrolled}
          sublabel={
            data.billingCounter.lastUpdatedAt
              ? `Updated ${new Date(data.billingCounter.lastUpdatedAt).toLocaleString()}`
              : undefined
          }
          variant="success"
          icon="🎓"
        />
        <StatCard
          label="Flagged Guardians"
          value={data.flaggedGuardians.length}
          sublabel="2+ expired enrollments"
          variant={data.flaggedGuardians.length === 0 ? "success" : "warning"}
          icon="🚩"
        />
        <StatCard
          label="Locked Admin Accounts"
          value={data.lockedAdmins.length}
          variant={data.lockedAdmins.length === 0 ? "success" : "danger"}
          icon="🔒"
        />
      </div>

      {/* Seat fill rates */}
      {data.seatFillRates.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Seat Fill Rates</h3>
            <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
          </div>
          <div className="space-y-3">
            {data.seatFillRates.map((s, i) => {
              const fillColor = s.fillRate >= 90 ? "danger" : s.fillRate >= 70 ? "warning" : "success"
              const fillColorMap = {
                danger: "bg-red-500",
                warning: "bg-amber-500",
                success: "bg-emerald-500",
              }

              return (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <p className="font-medium text-gray-700 dark:text-gray-300">
                      {s.branchName} · {s.gradeName}
                      {s.streamName && <span className="text-gray-400 dark:text-gray-500"> ({s.streamName})</span>}
                    </p>
                    <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                      <span>
                        {s.enrolledSeats}/{s.totalSeats} enrolled
                      </span>
                      <span className={`font-bold ${
                        s.fillRate >= 90
                          ? "text-red-600 dark:text-red-400"
                          : s.fillRate >= 70
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}>
                        {s.fillRate}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${fillColorMap[fillColor]}`}
                      style={{ width: `${Math.min(100, s.fillRate)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Flagged guardians */}
      {data.flaggedGuardians.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-400">Flagged Guardians</h3>
            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/30">
              {data.flaggedGuardians.length}
            </span>
            <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
            <span className="text-[10px] text-gray-400 dark:text-gray-500">2+ expired enrollments</span>
          </div>
          <div className="space-y-2">
            {data.flaggedGuardians.map((g) => (
              <div
                key={g.guardianId}
                className="rounded-xl border border-amber-200/50 dark:border-amber-800/30 bg-amber-50/30 dark:bg-amber-900/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all duration-200 hover:shadow-md"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {g.guardianName}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>{g.guardianPhone}</span>
                    <span className="text-gray-300 dark:text-white/20">·</span>
                    <span>Student: {g.studentName}</span>
                    <span className="text-gray-400 dark:text-gray-500 font-mono">({g.studentStuId})</span>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200/50 dark:border-red-800/30 shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {g.expiredCount}× expired
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Locked admin accounts */}
      {data.lockedAdmins.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">Locked Admin Accounts</h3>
            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200/50 dark:border-red-800/30">
              {data.lockedAdmins.length}
            </span>
            <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
          </div>
          <div className="space-y-2">
            {data.lockedAdmins.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-red-200/50 dark:border-red-800/30 bg-red-50/30 dark:bg-red-900/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all duration-200 hover:shadow-md"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {a.full_name ?? a.email}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>{a.email}</span>
                    <span className="text-gray-300 dark:text-white/20">·</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 border border-gray-200/50 dark:border-white/10">
                      {a.role}
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleUnlock(a.id)}
                  disabled={unlockingId === a.id}
                  className="rounded-lg border-red-200 dark:border-red-800/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  {unlockingId === a.id ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                      </svg>
                      Unlocking...
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                      </svg>
                      Unlock
                    </span>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent overrides */}
      {data.recentOverrides.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Recent Manual Overrides</h3>
            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#6c63ff]/10 text-[#6c63ff] border border-[#6c63ff]/20">
              {data.recentOverrides.length}
            </span>
            <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
            <span className="text-[10px] text-gray-400 dark:text-gray-500">Last 7 days</span>
          </div>
          <div className="space-y-1.5">
            {data.recentOverrides.map((o) => {
              const val = o.new_value as OverrideValue | null
              const displayStatus = val?.status ? String(val.status) : ""
              const displayAction = o.action_type ? String(o.action_type) : ""
              const displayReason = val?.reason ? String(val.reason) : ""

              return (
                <div
                  key={o.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-gray-50/50 dark:bg-white/5 border border-gray-100/50 dark:border-white/5"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/30">
                      {displayAction}
                    </span>
                    {displayStatus && (
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        → {displayStatus}
                      </span>
                    )}
                    {displayReason.length > 0 && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-xs">
                        "{displayReason}"
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                    {new Date(o.created_at).toLocaleString()}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* All clear states */}
      {data.flaggedGuardians.length === 0 &&
        data.lockedAdmins.length === 0 &&
        data.paymentClaims.pendingCount === 0 &&
        data.webhooks.failuresLast24h === 0 && (
          <div className="relative overflow-hidden rounded-xl bg-linear-to-br from-emerald-50/80 to-emerald-50/30 dark:from-emerald-900/20 dark:to-emerald-900/5 border border-emerald-200/50 dark:border-emerald-800/30 p-5">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl" />
            <div className="relative flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">✓ All Systems Healthy</p>
                <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">No issues detected — everything is running smoothly.</p>
              </div>
            </div>
          </div>
        )}
    </div>
  )
}