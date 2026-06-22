// components/admin/stream-management.tsx
// Redesigned stream management UI with modern styling

"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import SensitiveActionModal from "@/components/admin/sensitive-action-modal"

interface Stream {
  id: string
  name: string
  is_active: boolean
  created_at: string
}

interface ChebretaBranch {
  id: string
  name: string
}

export default function StreamManagement() {
  const [streams, setStreams] = useState<Stream[]>([])
  const [chebranch, setChebranch] = useState<ChebretaBranch | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const fetchStreams = useCallback(async () => {
    try {
      const response = await fetch("/api/master/streams")
      if (!response.ok) {
        setError("Could not load streams")
        return
      }
      const data = await response.json()
      setStreams(data.streams ?? [])
      setChebranch(data.chebranch ?? null)
    } catch {
      setError("Could not load streams")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStreams()
  }, [fetchStreams])

  async function handleToggle(stream: Stream) {
    setError(null)
    setSuccessMessage(null)
    setProcessingId(stream.id)

    try {
      const response = await fetch(`/api/master/streams/${stream.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !stream.is_active }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? "Could not update stream")
        return
      }

      setSuccessMessage(
        `${stream.name} stream has been ${!stream.is_active ? "activated" : "deactivated"}.`
      )
      await fetchStreams()
    } catch {
      setError("Could not update stream. Please try again.")
    } finally {
      setProcessingId(null)
    }
  }

  // Calculate stats
  const activeCount = streams.filter((s) => s.is_active).length
  const inactiveCount = streams.filter((s) => !s.is_active).length

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full border-4 border-[#6c63ff]/20 border-t-[#6c63ff] animate-spin" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading streams...</p>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50/50 dark:bg-white/5 border border-gray-100/50 dark:border-white/5">
                <div className="space-y-2">
                  <div className="h-4 w-32 rounded bg-gray-200 dark:bg-white/10" />
                  <div className="h-3 w-24 rounded bg-gray-200 dark:bg-white/10" />
                </div>
                <div className="h-8 w-20 rounded bg-gray-200 dark:bg-white/10" />
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
          <p className="text-2xl font-bold text-[#6c63ff] dark:text-[#9d97ff]">{streams.length}</p>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Total Streams</p>
        </div>
        <div className="rounded-xl bg-linear-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-200/50 dark:border-emerald-800/30 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{activeCount}</p>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Active</p>
        </div>
        <div className="rounded-xl bg-linear-to-br from-gray-500/10 to-gray-600/10 border border-gray-200/50 dark:border-white/10 p-4 text-center">
          <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{inactiveCount}</p>
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

      {/* Branch info banner */}
      <div className="relative overflow-hidden rounded-xl bg-linear-to-br from-blue-50/80 to-blue-50/30 dark:from-blue-900/20 dark:to-blue-900/5 border border-blue-200/50 dark:border-blue-800/30 p-5">
        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl" />
        <div className="relative flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-200/50 dark:border-blue-800/30 shrink-0">
            <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
              Exclusive to: {chebranch?.name ?? "Chereta"} Branch
            </p>
            <p className="text-xs text-blue-600/80 dark:text-blue-400/80 leading-relaxed mt-1">
              Streams are restricted to Grades 11 and 12 only. Assignment to other branches
              or grades is blocked at every level of the system.
            </p>
          </div>
        </div>
      </div>

      {/* Stream list */}
      <div className="space-y-3">
        {streams.map((stream) => {
          const isActive = stream.is_active
          const isProcessing = processingId === stream.id
          const icon = stream.name.toLowerCase().includes("natural") ? "🌿" : "🌊"

          return (
            <div
              key={stream.id}
              className={`group rounded-xl border p-5 transition-all duration-200 hover:shadow-md ${
                isActive
                  ? "border-gray-100/50 dark:border-white/8 bg-white dark:bg-white/3"
                  : "border-gray-200/50 dark:border-white/5 bg-gray-50/50 dark:bg-white/3"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                    isActive
                      ? "bg-[#6c63ff]/10 border border-[#6c63ff]/20"
                      : "bg-gray-100 dark:bg-white/5 border border-gray-200/50 dark:border-white/10"
                  }`}>
                    {icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {stream.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {chebranch?.name ?? "Chereta"} · Grades 11 & 12
                      </span>
                    </div>
                  </div>
                </div>

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

                  <SensitiveActionModal
                    actionDescription={`${isActive ? "Deactivate" : "Activate"} stream: ${stream.name}`}
                    onVerified={() => handleToggle(stream)}
                    variant={isActive ? "outline" : "default"}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <span className="flex items-center gap-1.5">
                        <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
                        </svg>
                        ...
                      </span>
                    ) : isActive ? (
                      <span className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
                        </svg>
                        Deactivate
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Activate
                      </span>
                    )}
                  </SensitiveActionModal>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Info note */}
      <div className="rounded-xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/20 p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              Stream Management Note
            </p>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/80 leading-relaxed mt-1">
              Only Natural and Social streams exist. New streams cannot be added via this interface — 
              contact the developer if the school introduces new stream types.
            </p>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {streams.length === 0 && !loading && (
        <div className="flex flex-col items-center py-12 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
          <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">No streams found</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Contact the developer to add new streams</p>
        </div>
      )}
    </div>
  )
}