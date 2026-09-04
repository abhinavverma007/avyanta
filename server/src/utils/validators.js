// Practical email check — not full RFC 5322, just "local@domain.tld" with no
// whitespace. Good enough to catch typos without rejecting real addresses.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_RE.test(email.trim());
}

module.exports = { isValidEmail, EMAIL_RE };
