// lib/utils/sensitive-action.ts
// Server-side helper for sensitive action verification
// Used in API routes that require Master Admin re-verification

import {
  isSensitiveActionVerified,
  getCurrentUser,
} from "@/lib/supabase/session"
import { NextResponse } from "next/server"

/**
 * Verify that the current user is a Master Admin with active
 * sensitive action re-verification.
 * Returns the user if verified, or a NextResponse error if not.
 */
export async function requireSensitiveActionVerified(): Promise<
  | { id: string; role: string; email: string; full_name: string | null; status: string }
  | NextResponse
> {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (user.role !== "MASTER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const verified = await isSensitiveActionVerified(user.id)
  if (!verified) {
    return NextResponse.json(
      { error: "Sensitive action re-verification required" },
      { status: 403 }
    )
  }

  return user
}