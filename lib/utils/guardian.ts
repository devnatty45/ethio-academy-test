// lib/utils/guardian.ts
// Guardian-specific server-side utilities

import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Check if a guardian has completed their profile.
 * Returns true only if profile exists and is_complete = true.
 */
export async function isGuardianProfileComplete(
  userId: string
): Promise<boolean> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("guardian_profiles")
    .select("is_complete")
    .eq("user_id", userId)
    .single()

  return data?.is_complete === true
}