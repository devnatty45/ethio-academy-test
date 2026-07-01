// lib/ratelimit.ts
// Rate limiting utility using Upstash Redis
// Used in proxy.ts to protect all routes before they reach API handlers
// All limits defined here — single source of truth

import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Each limiter is named for its specific endpoint category
// Key strategy: IP for unauthenticated, user ID for authenticated

export const rateLimiters = {
  // Auth callback — before session exists, key by IP
  authCallback: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 m"),
    prefix: "rl:auth_callback",
    analytics: false,
  }),

  // Account recovery form submission — key by IP
  recoveryRequest: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 h"),
    prefix: "rl:recovery_request",
    analytics: false,
  }),

  // Student claim request — key by IP
  claimRequest: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 h"),
    prefix: "rl:claim_request",
    analytics: false,
  }),

  // Enrollment submission — key by user ID
  enrollmentSubmit: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 h"),
    prefix: "rl:enrollment_submit",
    analytics: false,
  }),

  // Payment initiation — key by enrollment ID
  paymentInitiate: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 h"),
    prefix: "rl:payment_initiate",
    analytics: false,
  }),

  // Manual payment claim submission — key by enrollment ID
  manualPaymentClaim: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 h"),
    prefix: "rl:manual_payment_claim",
    analytics: false,
  }),

  // MFA verification attempts — key by account ID
  mfaVerification: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "5 m"),
    prefix: "rl:mfa_verification",
    analytics: false,
  }),

  // Document upload signature requests — key by user ID
  uploadSignature: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "1 h"),
    prefix: "rl:upload_signature",
    analytics: false,
  }),

  // Global catch-all — key by IP
  global: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, "1 m"),
    prefix: "rl:global",
    analytics: false,
  }),
}

// Helper: build a rate limit response with Retry-After header
export function rateLimitResponse(reset: number): Response {
  const retryAfter = Math.ceil((reset - Date.now()) / 1000)
  return new Response(
    JSON.stringify({ error: "Too many requests" }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    }
  )
}
