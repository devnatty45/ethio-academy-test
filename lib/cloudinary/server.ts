// lib/cloudinary/server.ts
// Cloudinary server-side utility
// NEVER import this in client components
// All Cloudinary API operations go through here

import { v2 as cloudinary } from "cloudinary"

// Configure once — called automatically on first import
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
})

export { cloudinary }

// Allowed document types — enforced server-side in addition to preset
// NEW
export const ALLOWED_FORMATS = ["jpg", "jpeg", "png", "pdf"] as const satisfies readonly string[]
export type AllowedFormat = (typeof ALLOWED_FORMATS)[number]

// Max file size: 10MB
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

// Magic bytes for file type validation
// Used in Step 50 (Phase 5) — defined here for reuse
export const MAGIC_BYTES: Record<string, number[]> = {
  jpg: [0xff, 0xd8, 0xff],
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47],
  pdf: [0x25, 0x50, 0x44, 0x46],
}

/**
 * Generate a signed upload signature for direct client-to-Cloudinary uploads.
 * The client uses this to upload directly — server never proxies file content.
 */
export function generateUploadSignature(params: {
  folder: string
  publicId: string
}): {
  signature: string
  timestamp: number
  cloudName: string
  apiKey: string
  uploadPreset: string
  folder: string
  publicId: string
} {
  const timestamp = Math.round(Date.now() / 1000)
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET!

  const paramsToSign: Record<string, string | number> = {
    folder: params.folder,
    public_id: params.publicId,
    timestamp,
    upload_preset: uploadPreset,
  }

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET!
  )

  return {
    signature,
    timestamp,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
    apiKey: process.env.CLOUDINARY_API_KEY!,
    uploadPreset,
    folder: params.folder,
    publicId: params.publicId,
  }
}

/**
 * Generate a signed URL for viewing a private Cloudinary asset.
 * Expires in 15 minutes — never return raw Cloudinary URLs to clients.
 */
export function generateSignedViewUrl(publicId: string): string {
  const expiresAt = Math.round(Date.now() / 1000) + 15 * 60 // 15 minutes

  return cloudinary.url(publicId, {
    secure: true,
    sign_url: true,
    type: "authenticated",
    expires_at: expiresAt,
  })
}

/**
 * Delete a file from Cloudinary.
 * Used when a disguised file is detected after upload — clean up immediately.
 */
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId, {
    invalidate: true,
    type: "authenticated",
  })
}

/**
 * Build the Cloudinary folder path for a document upload.
 * Structure: /{env}/{academic_year}/{branch_id}/{student_id}/{enrollment_id}
 */
export function buildDocumentFolder(params: {
  academicYearName: string
  branchId: string
  studentId: string
  enrollmentId: string
}): string {
  const env = process.env.APP_ENV ?? "development"
  return `${env}/${params.academicYearName}/${params.branchId}/${params.studentId}/${params.enrollmentId}`
}

/**
 * Build the public_id for a document upload.
 * Structure: {doc_type}_{timestamp}
 */
export function buildDocumentPublicId(docType: string): string {
  return `${docType}_${Date.now()}`
}