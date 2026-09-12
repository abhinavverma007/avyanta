// Practical email check — not full RFC 5322, just "local@domain.tld" with no
// whitespace. Good enough to catch typos without rejecting real addresses.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_RE.test(email.trim());
}

// VPA format: <handle>@<psp>, e.g. name@okhdfcbank. Handle allows letters,
// digits, dot, hyphen, underscore; the PSP suffix is letters only in
// practice. Loose on purpose — just enough to reject empty/garbage input,
// not a claim of exhaustively validating every real-world UPI provider.
const UPI_RE = /^[\w.-]{2,256}@[a-zA-Z]{2,64}$/;

function isValidUpiId(upiId) {
  return typeof upiId === 'string' && UPI_RE.test(upiId.trim());
}

module.exports = { isValidEmail, EMAIL_RE, isValidUpiId, UPI_RE };
