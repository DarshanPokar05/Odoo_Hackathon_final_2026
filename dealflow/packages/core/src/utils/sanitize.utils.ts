// ---------------------------------------------------------------------------
// Input sanitization utilities
// ---------------------------------------------------------------------------

/**
 * Normalizes an identifier (email lowercased, phone stripped of whitespace).
 */
export function normalizeIdentifier(identifier: string): string {
  const trimmed = identifier.trim();
  // If it looks like a phone number (starts with +), keep as-is but strip spaces
  if (trimmed.startsWith("+")) {
    return trimmed.replace(/\s+/g, "");
  }
  // Otherwise treat as email and lowercase
  return trimmed.toLowerCase();
}

/**
 * Returns whether the identifier is an email or phone.
 */
export function identifierType(identifier: string): "email" | "phone" {
  return identifier.startsWith("+") ? "phone" : "email";
}

/**
 * Masks an email for safe display in responses (e.g. j***@example.com).
 * Prevents user enumeration in cases where we still need to reference the address.
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const visible = local.length > 2 ? local[0] : "";
  return `${visible}***@${domain}`;
}

/**
 * Masks a phone number, showing only last 4 digits.
 */
export function maskPhone(phone: string): string {
  if (phone.length <= 4) return "****";
  return `****${phone.slice(-4)}`;
}

/**
 * Returns a masked version of whichever identifier was provided.
 */
export function maskIdentifier(identifier: string): string {
  return identifierType(identifier) === "email"
    ? maskEmail(identifier)
    : maskPhone(identifier);
}
