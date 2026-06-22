// lib/supabase/client.ts
// Supabase browser client — uses anon key
// Use this ONLY in client components ("use client")
// Never use this for privileged operations

import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}