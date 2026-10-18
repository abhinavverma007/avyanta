// Background for a calendar cell that counts as only part of a day: the worked
// share is filled green from the bottom up, the rest is the soft red used for
// an absent day — so a 62% cell reads as about two-thirds green. Null for a
// normal day (the cell's own status colour applies).
export function dayFill(percent?: number | null): string | null {
  if (!percent || percent >= 100) return null;
  const p = Math.max(0, Math.min(100, percent));
  return `linear-gradient(to top, #16A34A ${p}%, #FEE2E2 ${p}%)`;
}
