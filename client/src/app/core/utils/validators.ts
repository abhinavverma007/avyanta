// Practical email check — not full RFC 5322, just "local@domain.tld" with no
// whitespace. Mirrors server/src/utils/validators.js.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}
