// components/admin/export-tools-client.tsx
// Redesigned export tools client with modern UI

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

interface AcademicYear {
  id: string
  name: string
  status: string
}

interface Branch {
  id: string
  name: string
}

interface ExportToolsClientProps {
  years: AcademicYear[]
  branches: Branch[]
}

interface ExportConfig {
  label: string
  description: string
  endpoint: string
  requiresYear: boolean
  requiresDateRange: boolean
  requiresBranch: boolean
  icon: string
}

const EXPORTS: ExportConfig[] = [
  {
    label: "Enrolled Students",
    description: "All students with ENROLLED status — branch, grade, fee, academic result.",
    endpoint: "/api/master/exports/enrolled-students",
    requiresYear: true,
    requiresDateRange: false,
    requiresBranch: true,
    icon: "🎓",
  },
  {
    label: "Payment Records",
    description: "All payment records with Chapa and manual override details.",
    endpoint: "/api/master/exports/payments",
    requiresYear: false,
    requiresDateRange: true,
    requiresBranch: false,
    icon: "💳",
  },
  {
    label: "Waitlist Report",
    description: "Current waitlist state — WAITLISTED, WAITLIST_NOTIFIED, WAITLIST_EXPIRED.",
    endpoint: "/api/master/exports/waitlist",
    requiresYear: true,
    requiresDateRange: false,
    requiresBranch: false,
    icon: "📋",
  },
  {
    label: "Capacity Utilization",
    description: "Seat fill rates per branch and grade with available seat counts.",
    endpoint: "/api/master/exports/capacity",
    requiresYear: true,
    requiresDateRange: false,
    requiresBranch: false,
    icon: "💺",
  },
  {
    label: "Billing Summary",
    description: "Platform billing counter and per-branch revenue breakdown for invoice generation.",
    endpoint: "/api/master/exports/billing-summary",
    requiresYear: true,
    requiresDateRange: false,
    requiresBranch: false,
    icon: "💰",
  },
]

export default function ExportToolsClient({
  years,
  branches,
}: ExportToolsClientProps) {
  const [selectedYearId, setSelectedYearId] = useState(years[0]?.id ?? "")
  const [selectedBranchId, setSelectedBranchId] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [downloading, setDownloading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleExport(exportConfig: ExportConfig) {
    setError(null)

    if (exportConfig.requiresYear && !selectedYearId) {
      setError("Select an academic year first")
      return
    }
    if (exportConfig.requiresDateRange && (!dateFrom || !dateTo)) {
      setError("Enter a date range first")
      return
    }

    setDownloading(exportConfig.label)

    try {
      const params = new URLSearchParams()
      if (exportConfig.requiresYear && selectedYearId) {
        params.set("academicYearId", selectedYearId)
      }
      if (exportConfig.requiresDateRange) {
        if (dateFrom) params.set("dateFrom", dateFrom)
        if (dateTo) params.set("dateTo", dateTo)
        if (selectedYearId) params.set("academicYearId", selectedYearId)
      }
      if (exportConfig.requiresBranch && selectedBranchId) {
        params.set("branchId", selectedBranchId)
      }

      const response = await fetch(`${exportConfig.endpoint}?${params.toString()}`)

      if (!response.ok) {
        const data = await response.json()
        setError(data.error ?? "Export failed")
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url

      const disposition = response.headers.get("Content-Disposition")
      const filenameMatch = disposition?.match(/filename="(.+)"/)
      a.download = filenameMatch?.[1] ?? "export.csv"
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError("Export failed. Please try again.")
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="space-y-8">
      {/* Filters section */}
      <div className="rounded-xl border border-gray-100/50 dark:border-white/8 bg-white/50 dark:bg-white/3 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filter Options</h3>
          <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Academic Year <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-transparent px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
            >
              <option value="">Select year...</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name} ({y.status})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Branch <span className="text-gray-400">(optional)</span>
            </label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-transparent px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
            >
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Date From <span className="text-gray-400">(payments only)</span>
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-transparent px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Date To <span className="text-gray-400">(payments only)</span>
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-transparent px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50/80 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/20 animate-in fade-in slide-in-from-top-2 duration-300">
            <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}
      </div>

      {/* Export cards */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Available Exports</h3>
          <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
          <span className="text-[10px] text-gray-400 dark:text-gray-500">{EXPORTS.length} reports</span>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {EXPORTS.map((exp) => {
            const isDownloading = downloading === exp.label
            const isDisabled = isDownloading ||
              (exp.requiresYear && !selectedYearId) ||
              (exp.requiresDateRange && (!dateFrom || !dateTo))

            return (
              <div
                key={exp.label}
                className="group rounded-xl border border-gray-100/50 dark:border-white/8 bg-white/50 dark:bg-white/3 p-5 transition-all duration-200 hover:shadow-md hover:border-[#6c63ff]/20"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#6c63ff]/10 flex items-center justify-center text-2xl border border-[#6c63ff]/20 shrink-0 group-hover:scale-110 transition-transform duration-200">
                      {exp.icon}
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {exp.label}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        {exp.description}
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {exp.requiresYear && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/30">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Year required
                          </span>
                        )}
                        {exp.requiresDateRange && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/30">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Date range
                          </span>
                        )}
                        {exp.requiresBranch && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/30">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            Branch optional
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport(exp)}
                    disabled={isDisabled}
                    className={`shrink-0 rounded-lg transition-all duration-200 ${
                      isDisabled
                        ? "border-gray-200 dark:border-white/10 text-gray-400 dark:text-gray-500"
                        : "border-[#6c63ff]/30 text-[#6c63ff] hover:bg-[#6c63ff]/10 hover:border-[#6c63ff]"
                    }`}
                  >
                    {isDownloading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                        </svg>
                        Downloading...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download CSV
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Info note */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-900/5 border border-blue-100/50 dark:border-blue-800/20">
        <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-xs font-medium text-blue-700 dark:text-blue-400">Export Information</p>
          <p className="text-xs text-blue-600/80 dark:text-blue-400/80 leading-relaxed mt-0.5">
            All exports are CSV files that can be opened in any spreadsheet application.
            Each export is logged in the audit trail for security purposes.
          </p>
        </div>
      </div>
    </div>
  )
}