// lib/sms/server.ts
// Purpose: SMS Ethiopia API integration
// sendSms() is the actual delivery function — called by the
// background processor, never called directly from request handlers
// queueSms() already exists in lib/utils/sms.ts and is the
// correct entry point for all application code
const SMS_ETHIOPIA_BASE_URL = "https://smsethiopia.com/api"
// Alternative: Afro Message — change base URL and auth header
// per provider. SMS Ethiopia is the default per project spec.

/**
 * Normalize Ethiopian phone numbers to the format the SMS
 * provider expects: +251XXXXXXXXX
 * Handles: 09XXXXXXXX, 07XXXXXXXX, +2519XXXXXXXX, 2519XXXXXXXX
 */
export function normalizeEthiopianPhone(phone: string): string {
  const cleaned = phone.replace(/\s+/g, "").replace(/-/g, "")

  // Already in full international format
  if (cleaned.startsWith("+251")) {
    return cleaned
  }

  // International without +
  if (cleaned.startsWith("251") && cleaned.length === 12) {
    return `+${cleaned}`
  }

  // Local format starting with 0
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    return `+251${cleaned.slice(1)}`
  }

  // 9 digits — assume Ethiopian local without leading 0
  if (cleaned.length === 9) {
    return `+251${cleaned}`
  }

  // Return as-is — let the API reject it if truly invalid
  return cleaned
}

export interface SmsSendResult {
  success: boolean
  providerId: string | null
  error: string | null
}

export async function sendSms(
  phone: string,
  message: string
): Promise<SmsSendResult> {
  const apiKey = process.env.SMS_ETHIOPIA_API_KEY
  const senderId = process.env.SMS_ETHIOPIA_SENDER_ID ?? "EthioAcademy"

  if (!apiKey) {
    return {
      success: false,
      providerId: null,
      error: "SMS_ETHIOPIA_API_KEY not configured",
    }
  }

  // SMS Ethiopia expects clean digits without the '+' sign (e.g., 2519...)
  const normalizedPhone = normalizeEthiopianPhone(phone).replace("+", "")

  try {
    // Corrected endpoint path: /sms/send
    const response = await fetch(`${SMS_ETHIOPIA_BASE_URL}/sms/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "KEY": apiKey, // Custom Authorization Header keyword required by provider
      },
      body: JSON.stringify({
        sender: senderId,
        msisdn: normalizedPhone, // Corrected recipient parameter key
        text: message,           // Corrected text parameter key
      }),
    })

    console.log(`📡 [SMS API HTTP Status]: ${response.status} ${response.statusText}`)

    const textData = await response.text()
    console.log("📄 [SMS API Raw Response Text]:", textData)

    let data: any = {}
    try {
      data = JSON.parse(textData)
    } catch {
      return {
        success: false,
        providerId: null,
        error: `Failed to parse JSON. Status: ${response.status}`,
      }
    }

    // SMS Ethiopia sends back status: "success" on clear entries
    // SMS Ethiopia sends back {"sent": true, "id": 0, "description": "Accepted for delivery"}
    if (!response.ok || data.sent !== true) {
      return {
        success: false,
        providerId: null,
        error: data.description || `HTTP error ${response.status}`,
      }
    }

    return {
      success: true,
      providerId: data.id !== undefined ? String(data.id) : null,
      error: null,
    }
  } catch (err) {
    console.error("🚨 [SMS Network Catch Error]:", err)
    return {
      success: false,
      providerId: null,
      error: err instanceof Error ? err.message : "Network error",
    }
  }
}