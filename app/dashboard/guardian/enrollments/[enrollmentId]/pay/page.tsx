// app/dashboard/guardian/enrollments/[enrollmentId]/pay/page.tsx
// Redesigned Payment page with modern UI

import { requireRole } from "@/lib/supabase/session"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import Link from "next/link"
import PayClient from "@/components/guardian/pay-client"
import ManualPaymentClaimForm from "@/components/guardian/manual-payment-claim-form"
import ChapaReferenceClaimForm from "@/components/guardian/chapa-reference-claim-form"

interface PayPageProps {
  params: Promise<{ enrollmentId: string }>
}

export default async function PayPage({ params }: PayPageProps) {
  const user = await requireRole("GUARDIAN")
  const { enrollmentId } = await params

  const adminClient = createAdminClient()
  const { data: enrollment } = await adminClient
    .from("enrollments")
    .select(`
      id, status, payment_deadline_at, fee_structure_id,
      students!inner (full_name),
      fee_structures (total_amount)
    `)
    .eq("id", enrollmentId)
    .eq("guardian_id", user.id)
    .single()

  if (!enrollment || enrollment.status !== "PAYMENT_PENDING") {
    redirect(`/dashboard/guardian/enrollments/${enrollmentId}`)
  }

  const student = Array.isArray(enrollment.students)
    ? enrollment.students[0]
    : enrollment.students
  const feeStructure = Array.isArray(enrollment.fee_structures)
    ? enrollment.fee_structures[0]
    : enrollment.fee_structures

  return (
    <div className="min-h-screen bg-linear-to-br from-[#f8f7ff] via-white to-[#f0eeff] dark:from-[#0a0a1a] dark:via-[#0d0d1a] dark:to-[#0f0f24] px-4 py-8 md:py-12">
      <div className="mx-auto max-w-3xl">
        {/* Back button */}
        <div className="mb-8">
          <Link 
            href={`/dashboard/guardian/enrollments/${enrollmentId}`}
            className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-[#6c63ff] dark:hover:text-[#9d97ff] transition-colors group"
          >
            <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Enrollment
          </Link>
        </div>

        {/* Main Card */}
        <div className="relative">
          <div className="absolute -inset-1 bg-linear-to-r from-[#6c63ff]/20 via-transparent to-[#6c63ff]/20 rounded-3xl blur-xl opacity-30" />
          
          <div className="relative bg-white/80 dark:bg-[#13132b]/80 backdrop-blur-xl rounded-2xl border border-gray-100/50 dark:border-white/8 shadow-2xl shadow-[#6c63ff]/5 overflow-hidden">
            
            {/* Header */}
            <div className="relative px-6 pt-8 pb-6 border-b border-gray-100/50 dark:border-white/5">
              <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-[#6c63ff] via-[#8b83ff] to-[#6c63ff]" />
              
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-[#6c63ff]/20 to-[#8b83ff]/20 flex items-center justify-center shrink-0 border border-[#6c63ff]/20">
                  <svg className="w-7 h-7 text-[#6c63ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                    Complete Payment
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {student?.full_name}
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6 space-y-8">
              {/* Chapa Payment */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Online Payment</h3>
                  <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
                </div>
                <PayClient
                  enrollmentId={enrollmentId}
                  totalAmount={feeStructure?.total_amount ?? 0}
                  deadlineAt={enrollment.payment_deadline_at}
                />
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200/50 dark:border-white/10" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 text-xs font-medium text-gray-400 dark:text-gray-500 bg-white/80 dark:bg-[#13132b]/80">
                    OR
                  </span>
                </div>
              </div>

              {/* Manual Payment */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Manual Payment</h3>
                  <div className="flex-1 h-px bg-gray-200/50 dark:bg-white/10" />
                </div>
                
                <div className="space-y-4">
                  <ManualPaymentClaimForm
                    enrollmentId={enrollmentId}
                    totalAmount={feeStructure?.total_amount ?? 0}
                  />
                  
                  <div className="pt-2">
                    <ChapaReferenceClaimForm enrollmentId={enrollmentId} />
                  </div>
                </div>
              </div>

              {/* Security notice */}
              <div className="flex items-center justify-center gap-6 pt-2 border-t border-gray-100/50 dark:border-white/5">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span className="text-xs text-gray-400 dark:text-gray-500">Secure Payment</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span className="text-xs text-gray-400 dark:text-gray-500">End-to-end Encrypted</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}