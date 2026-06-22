// lib/utils/enrollment-transitions.ts
// Defines which manual transitions Master Admin can make and
// what capacity adjustments each one requires

export type EnrollmentStatus =
  | "PENDING_REVIEW"
  | "REJECTED"
  | "PAYMENT_PENDING"
  | "ENROLLED"
  | "WAITLISTED"
  | "WAITLIST_NOTIFIED"
  | "WAITLIST_EXPIRED"
  | "EXPIRED"
  | "CANCELLED"
  | "TRANSFER_PENDING"

// For each current status, list valid target statuses Master Admin
// can manually transition to, and what capacity adjustment is needed
export const VALID_MANUAL_TRANSITIONS: Record<
  EnrollmentStatus,
  {
    to: EnrollmentStatus
    capacityAction:
      | "none"
      | "pending_to_reserved"
      | "pending_release"
      | "reserved_release"
      | "reserved_to_enrolled"
      | "enrolled_release"
      | "waitlist_release"
  }[]
> = {
  PENDING_REVIEW: [
    { to: "REJECTED", capacityAction: "pending_release" },
    { to: "CANCELLED", capacityAction: "pending_release" },
    { to: "PAYMENT_PENDING", capacityAction: "pending_to_reserved" },
  ],
  REJECTED: [
    { to: "PENDING_REVIEW", capacityAction: "none" },
    { to: "CANCELLED", capacityAction: "none" },
  ],
  PAYMENT_PENDING: [
    { to: "ENROLLED", capacityAction: "reserved_to_enrolled" },
    { to: "EXPIRED", capacityAction: "reserved_release" },
    { to: "CANCELLED", capacityAction: "reserved_release" },
    { to: "PENDING_REVIEW", capacityAction: "none" },
  ],
  ENROLLED: [
    { to: "CANCELLED", capacityAction: "enrolled_release" },
  ],
  WAITLISTED: [
    { to: "CANCELLED", capacityAction: "waitlist_release" },
    { to: "PENDING_REVIEW", capacityAction: "none" },
  ],
  WAITLIST_NOTIFIED: [
    { to: "CANCELLED", capacityAction: "waitlist_release" },
    { to: "PENDING_REVIEW", capacityAction: "none" },
  ],
  WAITLIST_EXPIRED: [
    { to: "CANCELLED", capacityAction: "none" },
  ],
  EXPIRED: [
    { to: "PENDING_REVIEW", capacityAction: "none" },
    { to: "CANCELLED", capacityAction: "none" },
  ],
  CANCELLED: [],
  TRANSFER_PENDING: [
    { to: "PENDING_REVIEW", capacityAction: "none" },
    { to: "CANCELLED", capacityAction: "none" },
  ],
}