// lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { cookies, headers } from "next/headers"

export async function createClient() {
  const headerStore = await headers()
  const authHeader =
    headerStore.get("Authorization") || headerStore.get("authorization")
  const isMobileRequest = authHeader?.startsWith("Bearer ") ?? false

  if (isMobileRequest) {
    const token = authHeader!.split(" ")[1]

    // Mobile: validate the JWT directly against Supabase Auth via a
    // real Authorization header. We deliberately do NOT use
    // createServerClient/cookies here — its cookie adapter expects a
    // full serialized session under a `sb-<ref>-auth-token` cookie,
    // not a raw access token, so faking a cookie never authenticates.
    return createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      }
    )
  }

  // Web: standard cookie-based session
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component — safe to ignore
          }
        },
      },
    }
  )
}
