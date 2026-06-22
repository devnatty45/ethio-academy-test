// lib/supabase/session.ts
// Full replacement — adds MFA session verification helpers

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { cookies } from "next/headers"
import type { SafeUser } from "@/types/api"

export async function getCurrentUser(): Promise<SafeUser | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from("users")
    .select("id, email, full_name, role, status")
    .eq("id", user.id)
    .single()

  if (!data) return null
  if (data.status === "DEACTIVATED") return null

  return {
    id: data.id,
    email: data.email,
    full_name: data.full_name,
    role: data.role,
    status: data.status,
  }
}

export async function requireAuth(): Promise<SafeUser> {
  const user = await getCurrentUser()
  if (!user) {
    const { redirect } = await import("next/navigation")
    redirect("/")
  }
  return user!
}

export async function requireRole(
  ...roles: Array<import("@/types/database").UserRole>
): Promise<SafeUser> {
  const user = await requireAuth()
  if (!roles.includes(user.role)) {
    const { redirect } = await import("next/navigation")
    redirect("/")
  }
  return user
}

/**
 * Check if an admin has completed MFA setup (one-time).
 */
export async function isAdminMfaConfigured(
  userId: string
): Promise<boolean> {
  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from("admin_mfa")
    .select("is_configured")
    .eq("admin_id", userId)
    .single()

  return data?.is_configured === true
}

/**
 * Check if MFA has been verified in the current login session.
 * Reads from a signed server-side cookie set after TOTP verification.
 */
export async function isMfaVerifiedInSession(
  userId: string
): Promise<boolean> {
  const cookieStore = await cookies()
  const cookie = cookieStore.get(`mfa_verified_${userId}`)
  return cookie?.value === "true"
}

/**
 * Set the MFA verified cookie for the current session.
 * Called after successful TOTP verification.
 * HttpOnly, SameSite=Strict, Secure in production.
 */
export async function setMfaVerifiedCookie(userId: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(`mfa_verified_${userId}`, "true", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.APP_ENV === "production",
    // Session cookie — expires when browser closes
    path: "/",
  })
}

/**
 * Clear the MFA verified cookie on sign-out.
 */
export async function clearMfaVerifiedCookie(userId: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(`mfa_verified_${userId}`)
}

/**
 * Require MFA verified in current session.
 * Use in admin dashboard pages after requireRole().
 */
export async function requireMfaVerified(userId: string): Promise<void> {
  const verified = await isMfaVerifiedInSession(userId)
  if (!verified) {
    const { redirect } = await import("next/navigation")
    redirect("/dashboard/admin/mfa-verify")
  }
}


/**
 * Check if Master Admin has re-verified for sensitive actions recently.
 * Valid for 15 minutes from last verification.
 */
export async function isSensitiveActionVerified(
  userId: string
): Promise<boolean> {
  const cookieStore = await cookies()
  const cookie = cookieStore.get(`mfa_action_verified_${userId}`)
  if (!cookie?.value) return false

  const verifiedAt = parseInt(cookie.value, 10)
  if (isNaN(verifiedAt)) return false

  const fifteenMinutes = 15 * 60 * 1000
  return Date.now() - verifiedAt < fifteenMinutes
}

/**
 * Set the sensitive action verified cookie.
 * Stores the timestamp of verification — expires after 15 minutes.
 */
export async function setSensitiveActionVerifiedCookie(
  userId: string
): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(`mfa_action_verified_${userId}`, String(Date.now()), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.APP_ENV === "production",
    path: "/",
    maxAge: 15 * 60, // 15 minutes in seconds
  })
}

/**
 * Clear the sensitive action verified cookie.
 * Called after sensitive action completes or on sign-out.
 */
export async function clearSensitiveActionVerifiedCookie(
  userId: string
): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(`mfa_action_verified_${userId}`)
}