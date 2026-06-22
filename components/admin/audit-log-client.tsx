// components/admin/audit-log-client.tsx
// Redesigned audit log client with modern UI

"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface AuditLogEntry {
  id: string
  actorId: string | null
  actorRole: string
  actorName: string
  actionType: string
  targetTable: string
  targetId: string | null
  oldValue: unknown
  newValue: unknown
  createdAt: string
}

const ACTION_TYPE_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  ENROLLMENT_STATUS_OVERRIDE: {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200/50 dark:border-amber-800/30",
    dot: "bg-amber-500"
  },
  PAYMENT_CONFIRMED: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200/50 dark:border-emerald-800/30",
    dot: "bg-emerald-500"
  },
  PAYMENT_AMOUNT_MISMATCH: {
    bg: "bg-red-50 dark:bg-red-900/20",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200/50 dark:border-red-800/30",
    dot: "bg-red-500"
  },
  ENROLLMENT_APPROVED: {
    bg: "bg-blue-50 dark:bg-blue-900/20",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200/50 dark:border-blue-800/30",
    dot: "bg-blue-500"
  },
  ENROLLMENT_REJECTED: {
    bg: "bg-red-50 dark:bg-red-900/20",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200/50 dark:border-red-800/30",
    dot: "bg-red-500"
  },
  TRANSFER_INITIATED: {
    bg: "bg-orange-50 dark:bg-orange-900/20",
    text: "text-orange-700 dark:text-orange-400",
    border: "border-orange-200/50 dark:border-orange-800/30",
    dot: "bg-orange-500"
  },
  AUDIT_LOG_EXPORTED: {
    bg: "bg-gray-50 dark:bg-white/5",
    text: "text-gray-600 dark:text-gray-400",
    border: "border-gray-200/50 dark:border-white/10",
    dot: "bg-gray-400"
  },
}

const ACTOR_ROLES = ["MASTER_ADMIN", "BRANCH_ADMIN", "GUARDIAN", "SYSTEM"]

const TARGET_TABLES = [
  "enrollments",
  "payments",
  "manual_payment_claims",
  "enrollment_transfers",
  "audit_logs",
  "students",
  "users",
]

export default function AuditLogClient() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const [actorRole, setActorRole] = useState("")
  const [actionType, setActionType] = useState("")
  const [targetTable, setTargetTable] = useState("")
  const [targetId, setTargetId] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const buildParams = useCallback(
    (p: number) => {
      const params = new URLSearchParams()
      params.set("page", p.toString())
      if (actorRole) params.set("actorRole", actorRole)
      if (actionType) params.set("actionType", actionType)
      if (targetTable) params.set("targetTable", targetTable)
      if (targetId) params.set("targetId", targetId)
      if (dateFrom) params.set("dateFrom", dateFrom)
      if (dateTo) params.set("dateTo", dateTo)
      return params.toString()
    },
    [actorRole, actionType, targetTable, targetId, dateFrom, dateTo]
  )

  const fetchLogs = useCallback(
    async (p: number) => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/master/audit-logs?${buildParams(p)}`)
        const data = await response.json()
        if (!response.ok) {
          setError(data.error ?? "Could not load audit logs")
          return
        }
        setLogs(data.logs)
        setTotal(data.total)
        setTotalPages(data.totalPages)
        setPage(p)
      } catch {
        setError("Could not load audit logs")
      } finally {
        setLoading(false)
      }
    },
    [buildParams]
  )

  useEffect(() => {
    fetchLogs(1)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleExport() {
    setExporting(true)
    try {
      const response = await fetch(`/api/master/audit-logs/export?${buildParams(1)}`)
      if (!response.ok) {
        setError("Export failed")
        return
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError("Export failed")
    } finally {
      setExporting(false)
    }
  }

  if (loading && logs.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full border-4 border-[#6c63ff]/20 border-t-[#6c63ff] animate-spin" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading audit logs...</p>
          </div>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="p-4 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-gray-100/50 dark:border-white/5">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="h-4 w-32 rounded bg-gray-200 dark:bg-white/10" />
                    <div className="h-3 w-48 rounded bg-gray-200 dark:bg-white/10" />
                  </div>
                  <div className="h-4 w-24 rounded bg-gray-200 dark:bg-white/10" />
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
      {/* Filters */}
      <div className="rounded-xl border border-gray-100/50 dark:border-white/8 bg-white/50 dark:bg-white/3 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filters</h3>
          <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Actor Role
            </Label>
            <select
              value={actorRole}
              onChange={(e) => setActorRole(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-transparent px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
            >
              <option value="">All roles</option>
              {ACTOR_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Target Table
            </Label>
            <select
              value={targetTable}
              onChange={(e) => setTargetTable(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-transparent px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
            >
              <option value="">All tables</option>
              {TARGET_TABLES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Action Type
            </Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <Input
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                placeholder="e.g. PAYMENT_CONFIRMED"
                className="pl-9 rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Target Record ID
            </Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                </svg>
              </div>
              <Input
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                placeholder="UUID of specific record"
                className="pl-9 rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20 font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              From Date
            </Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              To Date
            </Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border-gray-200 dark:border-white/10 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            size="sm"
            onClick={() => fetchLogs(1)}
            disabled={loading}
            className="rounded-lg bg-linear-to-r from-[#6c63ff] to-[#7c73ff] hover:from-[#5a52e0] hover:to-[#6c63ff] text-white shadow-lg shadow-[#6c63ff]/25 hover:shadow-[#6c63ff]/40 transition-all duration-300"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                </svg>
                Loading...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Apply Filters
              </span>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setActorRole("")
              setActionType("")
              setTargetTable("")
              setTargetId("")
              setDateFrom("")
              setDateTo("")
              fetchLogs(1)
            }}
            className="rounded-lg border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-[#6c63ff]/40 hover:text-[#6c63ff]"
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear
            </span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            disabled={exporting || loading}
            className="ml-auto rounded-lg border-emerald-200 dark:border-emerald-800/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
          >
            {exporting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                </svg>
                Exporting...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export CSV
              </span>
            )}
          </Button>
        </div>
      </div>

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

      {/* Results */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {total} total entries · page {page} of {totalPages}
          </p>
        </div>

        {logs.length === 0 && !loading ? (
          <div className="flex flex-col items-center py-12 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
            <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm text-gray-500 dark:text-gray-400">No audit log entries found</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          logs.map((log) => {
            const statusColor = ACTION_TYPE_COLORS[log.actionType] || ACTION_TYPE_COLORS.AUDIT_LOG_EXPORTED
            const isExpanded = expandedId === log.id

            return (
              <div
                key={log.id}
                className={`rounded-xl border border-gray-100/50 dark:border-white/8 transition-all duration-200 ${
                  isExpanded ? "shadow-md" : "hover:shadow-sm"
                }`}
              >
                <button
                  className="w-full text-left px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors rounded-xl"
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium ${statusColor.bg} ${statusColor.text} ${statusColor.border} border`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusColor.dot}`} />
                        {log.actionType}
                      </span>
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {log.actorName}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">
                        ({log.actorRole})
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                      <span>{log.targetTable}</span>
                      {log.targetId && (
                        <span className="font-mono text-[10px]">
                          · {log.targetId.slice(0, 8)}...
                        </span>
                      )}
                      <span className="hidden sm:inline">·</span>
                      <span className="whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                      <svg className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100/50 dark:border-white/5 px-4 py-4 space-y-3 bg-gray-50/30 dark:bg-white/3 rounded-b-xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {log.oldValue != null && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                            Before
                          </p>
                          <pre className="text-xs bg-white dark:bg-[#0d0d1a] rounded-lg border border-gray-200 dark:border-white/10 p-3 overflow-auto max-h-48 font-mono text-gray-700 dark:text-gray-300">
                            {JSON.stringify(log.oldValue, null, 2)}
                          </pre>
                        </div>
                      )}
                      {log.newValue != null && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                            After
                          </p>
                          <pre className="text-xs bg-white dark:bg-[#0d0d1a] rounded-lg border border-gray-200 dark:border-white/10 p-3 overflow-auto max-h-48 font-mono text-gray-700 dark:text-gray-300">
                            {JSON.stringify(log.newValue, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-gray-400 dark:text-gray-500 pt-1 border-t border-gray-100/50 dark:border-white/5">
                      {log.targetId && (
                        <p className="font-mono">
                          Target ID: <span className="text-gray-600 dark:text-gray-400">{log.targetId}</span>
                        </p>
                      )}
                      {log.actorId && (
                        <p className="font-mono">
                          Actor ID: <span className="text-gray-600 dark:text-gray-400">{log.actorId}</span>
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 border-t border-gray-100/50 dark:border-white/5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchLogs(page - 1)}
            disabled={page <= 1 || loading}
            className="rounded-lg border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-[#6c63ff]/40 hover:text-[#6c63ff]"
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </span>
          </Button>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Page <span className="font-medium text-gray-700 dark:text-gray-300">{page}</span> of {totalPages}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchLogs(page + 1)}
            disabled={page >= totalPages || loading}
            className="rounded-lg border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-[#6c63ff]/40 hover:text-[#6c63ff]"
          >
            <span className="flex items-center gap-2">
              Next
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </Button>
        </div>
      )}
    </div>
  )
}