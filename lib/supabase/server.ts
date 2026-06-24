// lib/supabase/server.ts
// Supabase server client — reads session from cookies or mobile headers
// Use this in Server Components, API routes, and Server Actions
// This client respects RLS via the authenticated user's session

import { createServerClient } from "@supabase/ssr"
import { cookies, headers } from "next/headers"

export async function createClient() {
  const cookieStore = await cookies()
  const headerStore = await headers()

  // Extract the authorization header passed from the mobile app (if it exists)
  const authHeader = headerStore.get("Authorization")

  // Fallback map: If a mobile client sends a Bearer token instead of cookies,
  // we build a transient array for the underlying Supabase SSR library to digest.
  let mobileCookieOption = {}
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1]
    mobileCookieOption = {
      getAll() {
        return [
          { name: "sb-access-token", value: token }
        ]
      },
      setAll() {
        // Mobile state is managed client-side in Dart via Dio; no cookie setting needed.
      },
    }
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // If mobile token fallback is valid, use it; otherwise, default entirely to standard web cookies
      cookies: Object.keys(mobileCookieOption).length > 0
        ? mobileCookieOption
        : {
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
                // Middleware handles session refresh
              }
            },
          },
    }
  )
}
