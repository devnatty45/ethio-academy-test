// app/dashboard/master/billing/page.tsx
// Redesigned billing dashboard page with modern UI

import {
  requireRole,
  isAdminMfaConfigured,
  requireMfaVerified,
} from "@/lib/supabase/session"
import { redirect } from "next/navigation"
import BillingDashboard from "@/components/admin/billing-dashboard"

export default async function BillingPage() {
  const user = await requireRole("MASTER_ADMIN")

  const mfaConfigured = await isAdminMfaConfigured(user.id)
  if (!mfaConfigured) redirect("/dashboard/admin/mfa-setup")

  await requireMfaVerified(user.id)

  return (
    <div className="min-h-screen bg-linear-to-br from-[#f8f7ff] via-white to-[#f0eeff] dark:from-[#0a0a1a] dark:via-[#0d0d1a] dark:to-[#0f0f24] px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-[#6c63ff]/20 to-[#8b83ff]/20 flex items-center justify-center border border-[#6c63ff]/20">
              <svg className="w-7 h-7 text-[#6c63ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                Platform Billing Counter
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Total successful enrollments per academic year. Used to
                calculate the platform invoice at 100 ETB per enrollment.
              </p>
            </div>
          </div>

          {/* Main Card */}
          <div className="relative">
            <div className="absolute -inset-1 bg-linear-to-r from-[#6c63ff]/20 via-transparent to-[#6c63ff]/20 rounded-3xl blur-xl opacity-30" />
            
            <div className="relative bg-white/80 dark:bg-[#13132b]/80 backdrop-blur-xl rounded-2xl border border-gray-100/50 dark:border-white/8 shadow-2xl shadow-[#6c63ff]/5 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-[#6c63ff] via-[#8b83ff] to-[#6c63ff]" />
              
              <div className="px-6 py-6">
                <BillingDashboard />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}