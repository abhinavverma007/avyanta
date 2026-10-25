import { SiteLatLng } from '../components/location-picker/location-picker.component';

// "26.9124, 75.7873" (or space-separated) typed straight into an address box — anchored to
// the whole string so a real address (which has letters) never matches.
const LAT_LNG_RE = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

export function parseLatLng(text: string): SiteLatLng | null {
  const m = LAT_LNG_RE.exec(text);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

// Free OpenStreetMap geocoder, India only — the same lookup and settings the Assign Task form
// uses. Resolves to null when nothing matches; rejects if the lookup itself fails. Callers must
// debounce (Nominatim's free tier allows about one request a second).
export async function geocodeAddress(query: string): Promise<SiteLatLng | null> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(query)}`,
  );
  const results: Array<{ lat: string; lon: string }> = await res.json();
  if (results.length === 0) return null;
  return { lat: Number(results[0].lat), lng: Number(results[0].lon) };
}
