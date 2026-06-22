// app/dashboard/branch/review/[enrollmentId]/page.tsx
// Redesigned application detail review page

import {
  requireRole,
  isAdminMfaConfigured,
  requireMfaVerified,
} from "@/lib/supabase/session"
import { redirect } from "next/navigation"
import ApplicationReviewClient from "@/components/admin/application-review-client"

interface ReviewPageProps {
  params: Promise<{ enrollmentId: string }>
}

export default async function ApplicationReviewPage({
  params,
}: ReviewPageProps) {
  const user = await requireRole("BRANCH_ADMIN", "MASTER_ADMIN")

  const mfaConfigured = await isAdminMfaConfigured(user.id)
  if (!mfaConfigured) redirect("/dashboard/admin/mfa-setup")

  await requireMfaVerified(user.id)

  const { enrollmentId } = await params

  return (
    <div className="min-h-screen bg-linear-to-br from-[#f8f7ff] via-white to-[#f0eeff] dark:from-[#0a0a1a] dark:via-[#0d0d1a] dark:to-[#0f0f24] px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <ApplicationReviewClient
          enrollmentId={enrollmentId}
          adminRole={user.role}
        />
      </div>
    </div>
  )
}