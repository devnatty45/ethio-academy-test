// app/dashboard/branch/page.tsx
// Redesigned Branch Admin dashboard with modern UI

import {
  requireRole,
  isAdminMfaConfigured,
  requireMfaVerified,
} from "@/lib/supabase/session"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import BranchReviewQueue from "@/components/admin/branch-review-queue"
import DailySummaryWidget from "@/components/admin/daily-summary-widget"
import TransferQueue from "@/components/admin/transfer-queue"
import PaymentClaimsQueue from "@/components/admin/payment-claim-queue"

export default async function BranchDashboardPage() {
  const user = await requireRole("BRANCH_ADMIN")

  const mfaConfigured = await isAdminMfaConfigured(user.id)
  if (!mfaConfigured) redirect("/dashboard/admin/mfa-setup")

  await requireMfaVerified(user.id)

  const adminClient = createAdminClient()

  // Get admin's assigned branch
  const { data: adminProfile } = await adminClient
    .from("admin_profiles")
    .select(`
      assigned_branch_id,
      branches!admin_profiles_assigned_branch_id_fkey (name)
    `)
    .eq("user_id", user.id)
    .single()

  const branch = Array.isArray(adminProfile?.branches)
    ? adminProfile?.branches[0]
    : adminProfile?.branches

  return (
    <div className="min-h-screen bg-linear-to-br from-[#f8f7ff] via-white to-[#f0eeff] dark:from-[#0a0a1a] dark:via-[#0d0d1a] dark:to-[#0f0f24] px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-[#6c63ff]/20 to-[#8b83ff]/20 flex items-center justify-center border border-[#6c63ff]/20">
                <svg className="w-6 h-6 text-[#6c63ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                  {branch?.name ?? "Branch"} Admin Dashboard
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Welcome back, {user.full_name ?? user.email}
                </p>
              </div>
            </div>
          </div>
          
          {/* Action container for buttons */}
          <div className="flex items-center gap-3 self-end md:self-auto">
            {/* ── Log Out Form hitting your API route ── */}
            <form action="/api/auth/signout" method="POST">
              <Button 
                type="submit" 
                variant="ghost" 
                className="rounded-xl text-gray-500 hover:text-red-600 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-950/30 transition-all"
              >
                Log Out
              </Button>
            </form>

            <Link href="/dashboard/branch/academic-results">
              <Button className="bg-linear-to-r from-[#6c63ff] to-[#7c73ff] hover:from-[#5a52e0] hover:to-[#6c63ff] text-white rounded-xl shadow-lg shadow-[#6c63ff]/25 hover:shadow-[#6c63ff]/40 transition-all duration-300">
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Academic Results
                </span>
              </Button>
            </Link>

<Link href="/dashboard/branch/teachers">
  <Button variant="outline" className="rounded-xl border-[#6c63ff]/30 text-[#6c63ff] hover:bg-[#6c63ff]/5">
    <span className="flex items-center gap-2">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-8a4 4 0 11-8 0 4 4 0 018 0zm6 3a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
      Manage Teachers
    </span>
  </Button>
</Link>
          </div>
        </div>

        {/* Summary Widget */}
        <div className="bg-white/80 dark:bg-[#13132b]/80 backdrop-blur-xl rounded-2xl border border-gray-100/50 dark:border-white/8 shadow-xl shadow-[#6c63ff]/5 p-6">
          <DailySummaryWidget />
        </div>

        {/* Transfer Queue */}
        <div className="bg-white/80 dark:bg-[#13132b]/80 backdrop-blur-xl rounded-2xl border border-gray-100/50 dark:border-white/8 shadow-xl shadow-[#6c63ff]/5 p-6">
          <TransferQueue isMasterAdmin={false} />
        </div>

        {/* Review Queue */}
        <div className="bg-white/80 dark:bg-[#13132b]/80 backdrop-blur-xl rounded-2xl border border-gray-100/50 dark:border-white/8 shadow-xl shadow-[#6c63ff]/5 p-6">
          <BranchReviewQueue />
        </div>

        {/* Payment Claims Queue */}
        <div className="bg-white/80 dark:bg-[#13132b]/80 backdrop-blur-xl rounded-2xl border border-gray-100/50 dark:border-white/8 shadow-xl shadow-[#6c63ff]/5 p-6">
          <PaymentClaimsQueue />
        </div>
      </div>
    </div>
  )
}
