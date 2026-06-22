// app/api/admin/maintenance/sweep-payments/route.ts
// Purpose: Trigger the payment expiry sweep
// Called by: pg_cron (via x-cron-secret header) OR Master Admin manually

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { sweepExpiredPayments } from "@/lib/utils/payment-expiry"

function isCronRequest(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  return request.headers.get("x-cron-secret") === cronSecret
}

export async function POST(request: NextRequest) {
  // Allow pg_cron via shared secret OR Master Admin via session
  const isCron = isCronRequest(request)

  if (!isCron) {
    // Fall back to session-based auth for manual triggers
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminClient = createAdminClient()
    const { data: userData } = await adminClient
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!userData || userData.role !== "MASTER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  const result = await sweepExpiredPayments()
  return NextResponse.json(result)
}