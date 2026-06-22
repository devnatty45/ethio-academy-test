// components/admin/daily-summary-widget.tsx
// Redesigned daily summary widget with modern UI

"use client"

import { useState, useEffect } from "react"

interface Counts {
  pendingReview: number
  approvedToday: number
  rejectedToday: number
  paymentPending: number
  waitlisted: number
  enrolledToday: number
}

const CARDS: { key: keyof Counts; label: string; icon: React.ReactNode; color: string }[] = [
  {
    key: "pendingReview",
    label: "Pending Review",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: "from-amber-500/20 to-amber-600/20 border-amber-200/50 dark:border-amber-800/30 text-amber-700 dark:text-amber-400"
  },
  {
    key: "approvedToday",
    label: "Approved Today",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: "from-blue-500/20 to-blue-600/20 border-blue-200/50 dark:border-blue-800/30 text-blue-700 dark:text-blue-400"
  },
  {
    key: "rejectedToday",
    label: "Rejected Today",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: "from-red-500/20 to-red-600/20 border-red-200/50 dark:border-red-800/30 text-red-700 dark:text-red-400"
  },
  {
    key: "paymentPending",
    label: "Payment Pending",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    color: "from-purple-500/20 to-purple-600/20 border-purple-200/50 dark:border-purple-800/30 text-purple-700 dark:text-purple-400"
  },
  {
    key: "waitlisted",
    label: "Waitlisted",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: "from-gray-500/20 to-gray-600/20 border-gray-200/50 dark:border-white/10 text-gray-700 dark:text-gray-400"
  },
  {
    key: "enrolledToday",
    label: "Enrolled Today",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    color: "from-emerald-500/20 to-emerald-600/20 border-emerald-200/50 dark:border-emerald-800/30 text-emerald-700 dark:text-emerald-400"
  },
]

export default function DailySummaryWidget() {
  const [counts, setCounts] = useState<Counts | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSummary() {
      try {
        const response = await fetch("/api/admin/branch/summary")
        const data = await response.json()
        if (response.ok) setCounts(data.counts)
      } finally {
        setLoading(false)
      }
    }
    fetchSummary()
    const interval = setInterval(fetchSummary, 60000)
    return () => clearInterval(interval)
  }, [])

  if (loading || !counts) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="rounded-xl bg-gray-100 dark:bg-white/5 p-4 space-y-2">
              <div className="h-8 w-12 rounded bg-gray-200 dark:bg-white/10" />
              <div className="h-3 w-20 rounded bg-gray-200 dark:bg-white/10" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Today's Summary</h3>
        <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
        <span className="text-[10px] text-gray-400 dark:text-gray-500">
          Auto-refreshes
        </span>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {CARDS.map((card) => (
          <div
            key={card.key}
            className={`relative overflow-hidden rounded-xl bg-linear-to-br ${card.color} border p-4 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg`}
          >
            <div className="absolute top-0 right-0 w-16 h-16 bg-white/5 rounded-full blur-xl" />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-2xl font-bold">
                  {counts[card.key]}
                </p>
                <p className="text-[10px] font-medium opacity-80 mt-0.5">
                  {card.label}
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-white/20 dark:bg-white/10 flex items-center justify-center">
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}