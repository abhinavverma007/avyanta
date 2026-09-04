const crypto = require('crypto');

// Excludes visually ambiguous characters (0/O, 1/l/I) to keep generated
// passwords easy to read and retype off a screen.
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';

function generatePassword(length = 12) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += CHARSET[bytes[i] % CHARSET.length];
  return out;
}

module.exports = { generatePassword };
