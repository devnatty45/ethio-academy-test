// app/dashboard/page.tsx
// Dashboard index — immediately routes to role-specific dashboard
// Accessible to: authenticated users only

import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/supabase/session"

export default async function DashboardPage() {
  const user = await requireAuth()

  switch (user.role) {
    case "GUARDIAN":
      redirect("/dashboard/guardian")
    case "BRANCH_ADMIN":
      redirect("/dashboard/branch")
    case "MASTER_ADMIN":
      redirect("/dashboard/master")
    default:
      redirect("/")
  }
}