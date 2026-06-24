// lib/supabase/server.ts
// Supabase server client — reads session from cookies or mobile headers
// Use this in Server Components, API routes, and Server Actions
// This client respects RLS via the authenticated user's session

import { createServerClient } from "@supabase/ssr"
import { cookies, headers } from "next/headers"

export async function createClient() {
  const cookieStore = await cookies()
  const headerStore = await headers()

  // Case-Insensitivity Fix: Extract the authorization header using both common cases
  const authHeader = headerStore.get("Authorization") || headerStore.get("authorization")
  const isMobileRequest = authHeader && authHeader.startsWith("Bearer ")

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // If a mobile request provides a Bearer token, bypass local cookies entirely 
          // and wrap the incoming JWT token in a virtual cookie format for Supabase Auth
          if (isMobileRequest) {
            const token = authHeader.split(" ")[1]
            return [{ name: "sb-access-token", value: token }]
          }
          
          // Otherwise, proceed normally with standard browser cookies (Web App)
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          // For mobile clients, state is managed app-side via tokens, so skip cookie changes
          if (isMobileRequest) return

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
