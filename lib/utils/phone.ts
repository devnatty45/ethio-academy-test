// lib/utils/phone.ts
// Phone number normalization for Ethiopian numbers
// All phones stored in +251 format — never raw user input format

/**
 * Normalize an Ethiopian phone number to +251 format.
 * Accepts: 09XXXXXXXX, 07XXXXXXXX, +2519XXXXXXXX, 2519XXXXXXXX
 * Returns: +251XXXXXXXXX or null if invalid
 */
export function normalizeEthiopianPhone(raw: string): string | null {
  const cleaned = raw.replace(/\s+/g, "").replace(/-/g, "")

  // Already in +251 format
  if (/^\+251[79]\d{8}$/.test(cleaned)) {
    return cleaned
  }

  // 251 without +
  if (/^251[79]\d{8}$/.test(cleaned)) {
    return `+${cleaned}`
  }

  // Local format: 09XXXXXXXX or 07XXXXXXXX
  if (/^0[79]\d{8}$/.test(cleaned)) {
    return `+251${cleaned.slice(1)}`
  }

  return null
}

/**
 * Validate that a phone string is in normalized +251 format.
 */
export function isValidEthiopianPhone(phone: string): boolean {
  return /^\+251[79]\d{8}$/.test(phone)
}