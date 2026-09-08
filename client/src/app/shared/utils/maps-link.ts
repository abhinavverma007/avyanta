// Opens turn-by-turn directions in Google Maps (app on mobile, web on
// desktop) to the given point — a plain deep link, no API key needed.
export function googleMapsDirectionsUrl(loc: { lat: number; lng: number }): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`;
}
