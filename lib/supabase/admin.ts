// lib/supabase/admin.ts
// Supabase admin client — uses service role key, bypasses ALL RLS
// Use ONLY for operations that explicitly require elevated privileges
// NEVER import this in any client component or expose to the browser
// Every use must be justified and audited

import { createClient } from "@supabase/supabase-js"

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase environment variables for admin client"
    )
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}