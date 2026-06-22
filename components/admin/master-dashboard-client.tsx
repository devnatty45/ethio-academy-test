// components/admin/master-dashboard-client.tsx
// Redesigned Master Admin dashboard client section

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import SensitiveActionModal from "@/components/admin/sensitive-action-modal"
import LockedAccounts from "@/components/admin/locked-accounts"
import { Button } from "@/components/ui/button"

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
  category: "config" | "management" | "enrollment" | "monitoring" | "tools"
}

const NAV_ITEMS: NavItem[] = [
  // Configuration
  { label: "Branches", path: "/dashboard/master/branches", icon: "🏢", category: "config" },
  { label: "Grades", path: "/dashboard/master/grades", icon: "📚", category: "config" },
  { label: "Streams", path: "/dashboard/master/streams", icon: "🌊", category: "config" },
  { label: "Branch-Grade Config", path: "/dashboard/master/branch-grade-configs", icon: "⚙️", category: "config" },
  { label: "Stream Config", path: "/dashboard/master/branch-grade-stream-configs", icon: "🔀", category: "config" },
  { label: "Progression Rules", path: "/dashboard/master/grade-progression-rules", icon: "📈", category: "config" },
  { label: "Academic Years", path: "/dashboard/master/academic-years", icon: "📅", category: "config" },
  { label: "Seat Capacities", path: "/dashboard/master/seat-capacities", icon: "💺", category: "config" },
  { label: "Fee Structures", path: "/dashboard/master/fee-structures", icon: "💰", category: "config" },
  { label: "Document Rules", path: "/dashboard/master/document-requirement-rules", icon: "📄", category: "config" },
  { label: "Rejection Reasons", path: "/dashboard/master/rejection-reasons", icon: "❌", category: "config" },
  
  // Management
  { label: "Branch Admins", path: "/dashboard/master/branch-admins", icon: "👤", category: "management" },
  { label: "Billing Counter", path: "/dashboard/master/billing", icon: "🧾", category: "management" },
  { label: "Student Merge", path: "/dashboard/master/student-merge", icon: "🔄", category: "management" },
  { label: "Guardian Merge", path: "/dashboard/master/guardian-merge", icon: "👥", category: "management" },
  { label: "Recovery Requests", path: "/dashboard/master/recovery-requests", icon: "🔐", category: "management" },
  { label: "Claim Requests", path: "/dashboard/master/claim-requests", icon: "📋", category: "management" },
  
  // Enrollment
  // { label: "Academic Results", path: "/dashboard/branch/academic-results", icon: "🎓", category: "enrollment" },
  { label: "Enrollment Override", path: "/dashboard/master/enrollments/override", icon: "⚡", category: "enrollment" },
  { label: "Extend Payment Deadline", path: "/dashboard/master/enrollments/extend-deadline", icon: "⏰", category: "enrollment" },
  
  // Monitoring
  { label: "Payment Reconciliation", path: "/dashboard/master/payments", icon: "💳", category: "monitoring" },
  { label: "Audit Logs", path: "/dashboard/master/audit-logs", icon: "📋", category: "monitoring" },
  { label: "Student History", path: "/dashboard/master/students/history", icon: "📖", category: "monitoring" },
  { label: "Failed SMS", path: "/dashboard/master/sms", icon: "📱", category: "monitoring" },
  { label: "System Health", path: "/dashboard/master/health", icon: "❤️", category: "monitoring" },
  
  // Tools
  { label: "Export Tools", path: "/dashboard/master/exports", icon: "📤", category: "tools" },
]

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  config: { label: "Configuration", icon: "⚙️" },
  management: { label: "Management", icon: "👥" },
  enrollment: { label: "Enrollment", icon: "📝" },
  monitoring: { label: "Monitoring & Logs", icon: "📊" },
  tools: { label: "Tools", icon: "🔧" },
}

export default function MasterDashboardClient() {
  const router = useRouter()
  const [actionResult, setActionResult] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")

  const filteredItems = NAV_ITEMS.filter((item) => {
    const matchesSearch = item.label.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const categories = ["all", ...new Set(NAV_ITEMS.map((item) => item.category))]

  return (
    <div className="space-y-8">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl bg-linear-to-br from-[#6c63ff]/10 to-[#8b83ff]/10 border border-[#6c63ff]/20 p-4 text-center">
          <p className="text-2xl font-bold text-[#6c63ff] dark:text-[#9d97ff]">24</p>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Total Items</p>
        </div>
        <div className="rounded-xl bg-linear-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-200/50 dark:border-emerald-800/30 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">8</p>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Configurations</p>
        </div>
        <div className="rounded-xl bg-linear-to-br from-amber-500/10 to-amber-600/10 border border-amber-200/50 dark:border-amber-800/30 p-4 text-center">
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">6</p>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Management</p>
        </div>
        <div className="rounded-xl bg-linear-to-br from-blue-500/10 to-blue-600/10 border border-blue-200/50 dark:border-blue-800/30 p-4 text-center">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">10</p>
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Monitoring & Tools</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search navigation items..."
            className="w-full rounded-xl border-2 border-gray-200 dark:border-white/10 bg-white dark:bg-transparent pl-9 pr-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 focus:border-[#6c63ff] focus:ring-[#6c63ff]/20 transition-all duration-200"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                selectedCategory === cat
                  ? "bg-[#6c63ff] text-white shadow-lg shadow-[#6c63ff]/25"
                  : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10"
              }`}
            >
              {cat === "all" ? "All" : CATEGORY_LABELS[cat]?.label || cat}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
        {filteredItems.map((item) => (
          <button
            key={item.path}
            onClick={() => router.push(item.path)}
            className="group flex items-center gap-2 p-3 rounded-xl border border-gray-100/50 dark:border-white/5 bg-white/50 dark:bg-white/3 hover:bg-[#6c63ff]/5 hover:border-[#6c63ff]/30 transition-all duration-200 hover:shadow-md text-left"
          >
            <span className="text-lg group-hover:scale-110 transition-transform duration-200">{item.icon}</span>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-[#6c63ff] dark:group-hover:text-[#9d97ff] transition-colors">
              {item.label}
            </span>
          </button>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div className="flex flex-col items-center py-12 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
          <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">No items found</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Try adjusting your search or filter</p>
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-gray-100/50 dark:border-white/5" />

      {/* Locked Accounts */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Locked Accounts</h3>
          <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
        </div>
        <LockedAccounts />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-center gap-6 pt-2">
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">MFA Secured</span>
        </div>
        <div className="w-px h-3 bg-gray-200 dark:bg-white/10" />
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">Master Admin</span>
        </div>
        <div className="w-px h-3 bg-gray-200 dark:bg-white/10" />
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">Audit Logged</span>
        </div>
      </div>
    </div>
  )
}