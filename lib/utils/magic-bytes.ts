// lib/utils/magic-bytes.ts
// Magic byte file type validation
// Called after client uploads to Cloudinary to verify real file type
// If validation fails — file is deleted from Cloudinary immediately

import { cloudinary, deleteFromCloudinary, MAGIC_BYTES } from
  "@/lib/cloudinary/server"

type AllowedFileType = "jpg" | "jpeg" | "png" | "pdf"

interface MagicByteResult {
  valid: boolean
  detectedType: string | null
  reason: string | null
}

/**
 * Fetch the first 8 bytes of a Cloudinary file and check magic bytes.
 * Returns whether the file type matches what it claims to be.
 */
export async function validateMagicBytes(
  publicId: string,
  cloudName: string
): Promise<MagicByteResult> {
  try {
    // Generate a signed URL to fetch the file
    const signedUrl = cloudinary.url(publicId, {
      secure: true,
      sign_url: true,
      type: "authenticated",
      expires_at: Math.round(Date.now() / 1000) + 60, // 1 minute
    })

    // Fetch only the first 8 bytes using Range header
    const response = await fetch(signedUrl, {
      headers: { Range: "bytes=0-7" },
    })

    if (!response.ok && response.status !== 206) {
      return {
        valid: false,
        detectedType: null,
        reason: "Could not fetch file for validation",
      }
    }

    const buffer = await response.arrayBuffer()
    const bytes = new Uint8Array(buffer)

    // Check against known magic bytes
    const detectedType = detectFileType(bytes)

    if (!detectedType) {
      return {
        valid: false,
        detectedType: null,
        reason: "File type could not be determined from content",
      }
    }

    return {
      valid: true,
      detectedType,
      reason: null,
    }
  } catch (err) {
    return {
      valid: false,
      detectedType: null,
      reason: "Validation check failed",
    }
  }
}

/**
 * Detect file type from magic bytes.
 * Returns the file type string or null if unrecognized.
 */
function detectFileType(bytes: Uint8Array): AllowedFileType | null {
  // JPG/JPEG: FF D8 FF
  if (
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "jpg"
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png"
  }

  // PDF: 25 50 44 46 (%PDF)
  if (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return "pdf"
  }

  return null
}

/**
 * Validate a Cloudinary upload and delete if invalid.
 * Returns true if file is valid, false if it was deleted.
 */
export async function validateAndCleanup(
  publicId: string,
  cloudName: string
): Promise<{ valid: boolean; reason: string | null }> {
  const result = await validateMagicBytes(publicId, cloudName)

  if (!result.valid) {
    // Delete the invalid file from Cloudinary immediately
    try {
      await deleteFromCloudinary(publicId)
    } catch {
      // Log deletion failure but still return invalid
      console.error(
        `[MagicBytes] Failed to delete invalid file: ${publicId}`
      )
    }
    return { valid: false, reason: result.reason }
  }

  return { valid: true, reason: null }
}