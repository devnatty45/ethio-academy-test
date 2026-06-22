// lib/validations/common.ts
// Reusable Zod v4 validation schemas used across multiple API routes
// Import from "zod" directly — no subpath imports (Zod v4)

import { z } from "zod"

// UUID validation
export const uuidSchema = z.string().uuid()

// Ethiopian phone number — validated and normalized before storage
export const ethiopianPhoneSchema = z
  .string()
  .min(1)
  .refine(
    (val) => {
      const cleaned = val.replace(/\s+/g, "").replace(/-/g, "")
      return (
        /^\+251[79]\d{8}$/.test(cleaned) ||
        /^251[79]\d{8}$/.test(cleaned) ||
        /^0[79]\d{8}$/.test(cleaned)
      )
    },
    { message: "Invalid Ethiopian phone number" }
  )

// Pagination query params
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

// Academic year ID from query params
export const academicYearQuerySchema = z.object({
  academicYearId: uuidSchema,
})

// Student gender
export const genderSchema = z.enum(["MALE", "FEMALE"])

// Date of birth — must be a valid past date
export const dobSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .refine(
    (val) => {
      const date = new Date(val)
      const now = new Date()
      return !isNaN(date.getTime()) && date < now
    },
    { message: "Date of birth must be a valid past date" }
  )