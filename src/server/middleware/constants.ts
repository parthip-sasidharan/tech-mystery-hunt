/**
 * src/server/middleware/constants.ts
 * Shared constants used across the server middleware layer.
 */

/**
 * Generic, non-revealing authentication failure message.
 * Used for all login errors to prevent username/email enumeration.
 */
export const GENERIC_AUTH_ERROR =
  "Invalid credentials. Please check your details and try again.";
