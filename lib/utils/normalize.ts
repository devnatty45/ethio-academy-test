// lib/utils/normalize.ts
// Text normalization utilities for fuzzy matching
// Used when creating student records and running duplicate detection

/**
 * Normalize a full name for fuzzy matching storage.
 * Lowercases, trims, collapses whitespace, removes punctuation.
 * Stored in full_name_normalized column on students table.
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
}

/**
 * Normalize a date of birth for consistent storage and matching.
 * Always stores as YYYY-MM-DD string.
 */
export function normalizeDob(dob: Date | string): string {
  const date = typeof dob === "string" ? new Date(dob) : dob
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}