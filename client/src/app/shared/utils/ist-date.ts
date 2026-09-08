// Mirrors server/src/utils/istDate.js's istDateString() — the backend always
// computes "today" as an IST calendar day regardless of server timezone, so
// the frontend must match that exactly rather than using the browser's own
// timezone (toISOString() is UTC, which sits a full calendar day behind IST
// between 12:00 AM and 5:29 AM IST — enough to make a task dated "today"
// look like it's in the future on the client).
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function istDateString(date: Date = new Date()): string {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
