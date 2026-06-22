// lib/utils/totp.ts
// TOTP secret encryption and verification utilities
// Uses otplib v13 functional API — generate, verify, generateSecret
// TOTP secrets are encrypted before storage — never stored plaintext

import {
  generate,
  verify,
  generateSecret,
  generateURI,
} from "otplib"
import QRCode from "qrcode"
import { createAdminClient } from "@/lib/supabase/admin"
import crypto from "crypto"

function getEncryptionKey(): string {
  const key = process.env.FAN_FIN_ENCRYPTION_KEY
  if (!key) throw new Error("Encryption key not configured")
  return key
}

/**
 * Generate a new TOTP secret.
 * Returns the plaintext secret — caller must encrypt before storing.
 */
export function generateTotpSecret(): string {
  return generateSecret()
}

/**
 * Encrypt a TOTP secret using the same pgcrypto approach as FAN/FIN.
 */
export async function encryptTotpSecret(secret: string): Promise<string> {
  const supabase = createAdminClient()
  const key = getEncryptionKey()

  const { data, error } = await supabase.rpc("encrypt_fan_fin", {
    plaintext_value: secret,
    encryption_key: key,
  })

  if (error || !data) throw new Error("Failed to encrypt TOTP secret")
  return data as string
}

/**
 * Decrypt a TOTP secret for verification use.
 * Never return the decrypted secret to the frontend.
 */
export async function decryptTotpSecret(encrypted: string): Promise<string> {
  const supabase = createAdminClient()
  const key = getEncryptionKey()

  const { data, error } = await supabase.rpc("decrypt_totp_secret", {
    encrypted_value: encrypted,
    encryption_key: key,
  })

  if (error || !data) throw new Error("Failed to decrypt TOTP secret")
  return data as string
}

/**
 * Verify a TOTP code against an encrypted secret.
 */
/**
 * Verify a TOTP code against an encrypted secret.
 */
export async function verifyTotpCode(
  code: string,
  encryptedSecret: string
): Promise<boolean> {
  try {
    const secret = await decryptTotpSecret(encryptedSecret)
    
    // In otplib v13, windows are managed via epochTolerance
    const result = await verify({
      token: code,
      secret,
      epochTolerance: 30, // Allows ±30 seconds (1 step) clock drift
    })

    // verify() now returns an object { valid: boolean; delta: number }
    return result.valid
  } catch {
    return false
  }
}

/**
 * Generate a QR code data URL for the authenticator app setup.
 * Returns a base64 PNG data URL — rendered server-side only.
 */
export async function generateQrCodeDataUrl(
  secret: string,
  email: string
): Promise<string> {
  const otpAuthUrl = generateURI({
    secret,
    label: email,
    issuer: "School Registration System",
  })
  return await QRCode.toDataURL(otpAuthUrl)
}

/**
 * Generate 8 single-use backup codes.
 * Returns plaintext codes for display (shown once only)
 * and hashed codes for storage.
 */
export function generateBackupCodes(): {
  plaintext: string[]
  hashed: string[]
} {
  const plaintext = Array.from({ length: 8 }, () =>
    crypto.randomBytes(5).toString("hex").toUpperCase()
  )

  const hashed = plaintext.map((code) =>
    crypto.createHash("sha256").update(code).digest("hex")
  )

  return { plaintext, hashed }
}

/**
 * Verify a backup code against stored hashes.
 * Uses constant-time comparison to prevent timing attacks.
 * Returns the index of the matched code, or -1 if no match.
 */
export function verifyBackupCode(
  submitted: string,
  hashedCodes: string[]
): number {
  const submittedHash = crypto
    .createHash("sha256")
    .update(submitted.toUpperCase().trim())
    .digest("hex")

  for (let i = 0; i < hashedCodes.length; i++) {
    const stored = hashedCodes[i]
    if (
      stored !== undefined &&
      crypto.timingSafeEqual(
        Buffer.from(submittedHash, "hex"),
        Buffer.from(stored, "hex")
      )
    ) {
      return i
    }
  }
  return -1
}