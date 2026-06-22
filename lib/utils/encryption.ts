// lib/utils/encryption.ts
// Encryption utilities for sensitive PII fields
// FAN/FIN encrypted via pgcrypto — key from environment variable
// Key is passed to the DB function — never stored in the database itself
// Never log the input or output of this function

import { createAdminClient } from "@/lib/supabase/admin"

function getEncryptionKey(): string {
  const key = process.env.FAN_FIN_ENCRYPTION_KEY
  if (!key) {
    throw new Error("FAN_FIN_ENCRYPTION_KEY environment variable not set")
  }
  return key
}

/**
 * Encrypt a FAN/FIN number using pgcrypto via Supabase RPC.
 * Returns the encrypted string for storage in the database.
 * Never log the input or output of this function.
 */
export async function encryptFanFin(plaintext: string): Promise<string> {
  const supabase = createAdminClient()
  const key = getEncryptionKey()

  const { data, error } = await supabase.rpc("encrypt_fan_fin", {
    plaintext_value: plaintext,
    encryption_key: key,
  })

  if (error || !data) {
    console.error("[Encryption] RPC error:", JSON.stringify(error))
    console.error("[Encryption] Key present:", !!key, "Key length:", key.length)
    throw new Error("Encryption failed")
  }

  return data as string
}

/**
 * Verify a submitted FAN/FIN matches the stored encrypted value.
 * Used during account recovery confidence scoring.
 * Never returns the decrypted value — only returns boolean match.
 */
export async function verifyFanFin(
  plaintext: string,
  encrypted: string
): Promise<boolean> {
  const supabase = createAdminClient()
  const key = getEncryptionKey()

  const { data, error } = await supabase.rpc("verify_fan_fin", {
    plaintext_value: plaintext,
    encrypted_value: encrypted,
    encryption_key: key,
  })

  if (error) return false
  return data as boolean
}