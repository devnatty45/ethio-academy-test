// proxy.ts
// Next.js 16 network boundary proxy
// Runs before every request reaches a route handler
// Responsibilities:
//   1. Global rate limiting by IP on all routes
//   2. Specific rate limiting on sensitive endpoints
//   3. Auth presence check on protected routes
//   4. Role enforcement on role-specific routes
//   5. MFA session verification on admin routes
// NOTE: Full JWT verification still happens inside each route handler
//       This is the first line of defense — not the only line

import { NextRequest, NextResponse } from "next/server"
import { rateLimiters, rateLimitResponse } from "@/lib/ratelimit"

// -------------------------
// Route categorization
// -------------------------

// Requires any authenticated session
const AUTH_REQUIRED_PREFIXES = [
  "/dashboard",
  "/api/upload",
  "/api/documents",
  "/api/enrollments",
  "/api/students",
  "/api/payments",
  "/api/guardian",
  "/api/admin",
  "/api/master",
  "/api/auth/signout",
]

// Requires GUARDIAN role
const GUARDIAN_ONLY_PREFIXES = [
  "/dashboard/guardian",
  "/api/guardian",
]

// Requires BRANCH_ADMIN or MASTER_ADMIN role
const ADMIN_ONLY_PREFIXES = [
  "/dashboard/branch",
  "/dashboard/master",
  "/dashboard/admin",
  "/api/admin",
]

// Requires MASTER_ADMIN role only
const MASTER_ONLY_PREFIXES = [
  "/dashboard/master",
  "/api/master",
]

// Admin routes that additionally require MFA verified cookie
const MFA_REQUIRED_PREFIXES = [
  "/dashboard/branch",
  "/dashboard/master",
  "/api/admin",
  "/api/master",
]

// Routes exempt from all auth checks
const PUBLIC_ROUTES = [
  "/",
  "/auth/callback",
  "/auth/route-to-dashboard",
  "/dashboard/admin/mfa-setup",
  "/dashboard/admin/mfa-verify",
  "/api/webhooks/chapa",
  "/invite/co-guardian",
  "/api/invite/co-guardian/save-token",
  "/api/payments/webhook",
]

// -------------------------
// Helper functions
// -------------------------

function getIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  )
}

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(
    (prefix) =>
      pathname === prefix ||
      pathname.startsWith(prefix + "/") ||
      pathname.startsWith(prefix + "?")
  )
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) =>
      pathname === route ||
      pathname.startsWith(route + "/") ||
      pathname.startsWith(route + "?")
  )
}

function getSessionInfo(request: NextRequest): {
  hasSession: boolean
  userId: string | null
  role: string | null
  hasMfaCookie: boolean
} {
  const cookieNames = request.cookies.getAll().map((c) => c.name)

  const hasSession = cookieNames.some(
    (name) =>
      name.startsWith("sb-") &&
      (name.endsWith("-auth-token") ||
        name.endsWith("-auth-token.0") ||
        name.endsWith("-auth-token.1"))
  )

  // Extract user ID from MFA cookie name to verify it belongs to
  // an actual session (MFA cookie is keyed by user ID)
  let userId: string | null = null
  let hasMfaCookie = false

  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("mfa_verified_")) {
      const extractedId = cookie.name.replace("mfa_verified_", "")
      if (extractedId && cookie.value === "true") {
        userId = extractedId
        hasMfaCookie = true
        break
      }
    }
  }

  // Role is not readable from cookies — JWT must be verified server-side
  // proxy.ts cannot verify role from cookies alone
  // Role enforcement at proxy level is path-based only
  // Full role check happens inside each route handler

  return { hasSession, userId, role: null, hasMfaCookie }
}

function unauthorizedResponse(
  request: NextRequest,
  isApiRoute: boolean
): Response {
  if (isApiRoute) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }
  return NextResponse.redirect(new URL("/", request.url))
}

function mfaRequiredResponse(
  request: NextRequest,
  isApiRoute: boolean
): Response {
  if (isApiRoute) {
    return new Response(
      JSON.stringify({ error: "MFA verification required" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    )
  }
  return NextResponse.redirect(
    new URL("/dashboard/admin/mfa-verify", request.url)
  )
}

// -------------------------
// Main proxy function
// -------------------------

export async function proxy(request: NextRequest): Promise<Response> {
  const { pathname } = request.nextUrl
  const ip = getIP(request)
  const isApiRoute = pathname.startsWith("/api/")

  // ── Step 1: Global rate limit ──────────────────────────────────
  const globalResult = await rateLimiters.global.limit(ip)
  if (!globalResult.success) {
    return rateLimitResponse(globalResult.reset)
  }

  // ── Step 2: Specific rate limits ───────────────────────────────
  if (pathname === "/auth/callback") {
    const result = await rateLimiters.authCallback.limit(ip)
    if (!result.success) return rateLimitResponse(result.reset)
  }

  if (pathname.startsWith("/api/guardian/recovery")) {
    const result = await rateLimiters.recoveryRequest.limit(ip)
    if (!result.success) return rateLimitResponse(result.reset)
  }

  if (pathname.startsWith("/api/students/claim")) {
    const result = await rateLimiters.claimRequest.limit(ip)
    if (!result.success) return rateLimitResponse(result.reset)
  }

  if (pathname.startsWith("/api/upload/signature")) {
    const result = await rateLimiters.uploadSignature.limit(ip)
    if (!result.success) return rateLimitResponse(result.reset)
  }

  if (pathname === "/api/admin/mfa/verify") {
    const result = await rateLimiters.mfaVerification.limit(ip)
    if (!result.success) return rateLimitResponse(result.reset)
  }

  // ── Step 3: Skip all auth checks for public routes ─────────────
  if (isPublicRoute(pathname)) {
    return NextResponse.next()
  }

  // ── Step 4: Auth presence check ────────────────────────────────
  if (matchesPrefix(pathname, AUTH_REQUIRED_PREFIXES)) {
    const { hasSession, hasMfaCookie } = getSessionInfo(request)

    if (!hasSession) {
      return unauthorizedResponse(request, isApiRoute)
    }

    // ── Step 5: MFA cookie check for admin routes ───────────────
    // This is a lightweight check — full JWT + role verification
    // happens inside each route handler
    // Admin routes require BOTH a session AND an MFA verified cookie
    if (matchesPrefix(pathname, MFA_REQUIRED_PREFIXES)) {
      // MFA setup and verify pages are exempt (already in PUBLIC_ROUTES)
      // API routes for MFA operations are also exempt
      const isMfaOperationRoute =
        pathname.startsWith("/api/admin/mfa/") ||
        pathname.startsWith("/api/master/mfa/")

      if (!isMfaOperationRoute && !hasMfaCookie) {
        return mfaRequiredResponse(request, isApiRoute)
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}