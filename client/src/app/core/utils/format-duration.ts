// Turns a decimal hours value (as stored/computed for workHours) into plain
// "X hour(s) Y minutes" wording — a laborer reading "0.1h" has no intuitive
// sense of how long that actually is; exact minutes below an hour, and
// "H hour(s) M minutes" above it, both read immediately.
export function formatWorkDuration(hours: number): string {
  const totalMinutes = Math.max(0, Math.round(hours * 60));

  if (totalMinutes < 60) {
    return `${totalMinutes} minute${totalMinutes === 1 ? '' : 's'}`;
  }

  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const hourPart = `${h} hour${h === 1 ? '' : 's'}`;
  if (m === 0) return hourPart;
  return `${hourPart} ${m} minute${m === 1 ? '' : 's'}`;
}
