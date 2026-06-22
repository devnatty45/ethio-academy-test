// lib/chapa/server.ts
// Chapa payment gateway integration
// Docs: https://developer.chapa.co
import crypto from "crypto"

const CHAPA_BASE_URL = "https://api.chapa.co/v1"

interface ChapaInitializeParams {
  amount: number
  currency: "ETB"
  email: string
  firstName: string
  lastName: string
  phoneNumber: string
  txRef: string
  callbackUrl: string
  returnUrl: string
}

interface ChapaInitializeResponse {
  status: string
  message: string
  data: {
    checkout_url: string
  }
  errors?: Record<string, string[]>
}

export async function initializeChapaPayment(
  params: ChapaInitializeParams
): Promise<{
  success: boolean
  checkoutUrl: string | null
  error: unknown | null
}> {
  const secretKey = process.env.CHAPA_SECRET_KEY
  if (!secretKey) {
    return {
      success: false,
      checkoutUrl: null,
      error: "Payment gateway not configured",
    }
  }

  try {
    const response = await fetch(
      `${CHAPA_BASE_URL}/transaction/initialize`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: params.amount.toString(),
          currency: params.currency,
          email: params.email,
          first_name: params.firstName,
          last_name: params.lastName,
          phone_number: params.phoneNumber,
          tx_ref: params.txRef,
          callback_url: params.callbackUrl,
          return_url: params.returnUrl,
          customization: {
            title: "Ethio Academy", // 13 chars — safely under Chapa's 16-char hard limit
            description: "School enrollment payment",
          },
        }),
      }
    )

    const data: ChapaInitializeResponse = await response.json()

    if (!response.ok || data.status !== "success") {
      return {
        success: false,
        checkoutUrl: null,
        error:
          data.errors ?? data.message ?? "Could not initialize payment",
      }
    }

    return {
      success: true,
      checkoutUrl: data.data.checkout_url,
      error: null,
    }
  } catch {
    return {
      success: false,
      checkoutUrl: null,
      error: "Payment gateway unreachable",
    }
  }
}

export async function verifyChapaTransaction(txRef: string): Promise<{
  success: boolean
  status: string | null
  amount: number | null
  chapaReference: string | null
  error: string | null
}> {
  const secretKey = process.env.CHAPA_SECRET_KEY
  if (!secretKey) {
    return {
      success: false,
      status: null,
      amount: null,
      chapaReference: null,
      error: "Payment gateway not configured",
    }
  }

  try {
    const response = await fetch(
      `${CHAPA_BASE_URL}/transaction/verify/${txRef}`,
      {
        headers: { Authorization: `Bearer ${secretKey}` },
      }
    )

    const data = await response.json()

    if (!response.ok || data.status !== "success") {
      return {
        success: false,
        status: data.data?.status ?? null,
        amount: null,
        chapaReference: null,
        error: data.message ?? "Verification failed",
      }
    }

    // Chapa's own reference ID — distinct from our merchant tx_ref.
    // From the receipt PDF it appears as "Chapa: AP9p1LqacXxMc".
    // Their verify API returns it under data.reference or data.id.
    // We try both fields and fall back to null if neither exists.
    const chapaReference: string | null =
      data.data.reference ??
      data.data.chapa_ref ??
      data.data.id ??
      null

    return {
      success: true,
      status: data.data.status,
      amount: parseFloat(data.data.amount),
      chapaReference,
      error: null,
    }
  } catch {
    return {
      success: false,
      status: null,
      amount: null,
      chapaReference: null,
      error: "Verification request failed",
    }
  }
}

/**
 * Verify Chapa webhook authenticity.
 * Chapa sends the exact secret hash (configured in their dashboard)
 * back in the 'Chapa-Signature' header — this is a direct string
 * comparison, not an HMAC computation over the body.
 */
export function verifyChapaWebhookSignature(
  rawBody: string,
  signature: string | null
): boolean {
  if (!signature) return false

  const webhookSecret = process.env.CHAPA_WEBHOOK_SECRET
  if (!webhookSecret) return false

  try {
    const sigBuffer = Buffer.from(signature)
    const secretBuffer = Buffer.from(webhookSecret)

    if (sigBuffer.length !== secretBuffer.length) return false

    return crypto.timingSafeEqual(sigBuffer, secretBuffer)
  } catch {
    return false
  }
}