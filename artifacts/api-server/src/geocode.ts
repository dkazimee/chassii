const geocodeCache = new Map<string, { lat: number; lng: number } | null>();

const KNOWN_CITIES: Record<string, { lat: number; lng: number }> = {
  "los angeles, ca": { lat: 34.0522, lng: -118.2437 },
  "los angeles": { lat: 34.0522, lng: -118.2437 },
  "new york, ny": { lat: 40.7128, lng: -74.006 },
  "new york": { lat: 40.7128, lng: -74.006 },
  "chicago, il": { lat: 41.8781, lng: -87.6298 },
  "chicago": { lat: 41.8781, lng: -87.6298 },
  "houston, tx": { lat: 29.7604, lng: -95.3698 },
  "houston": { lat: 29.7604, lng: -95.3698 },
  "phoenix, az": { lat: 33.4484, lng: -112.074 },
  "phoenix": { lat: 33.4484, lng: -112.074 },
  "philadelphia, pa": { lat: 39.9526, lng: -75.1652 },
  "philadelphia": { lat: 39.9526, lng: -75.1652 },
  "san antonio, tx": { lat: 29.4241, lng: -98.4936 },
  "san antonio": { lat: 29.4241, lng: -98.4936 },
  "san diego, ca": { lat: 32.7157, lng: -117.1611 },
  "san diego": { lat: 32.7157, lng: -117.1611 },
  "dallas, tx": { lat: 32.7767, lng: -96.797 },
  "dallas": { lat: 32.7767, lng: -96.797 },
  "miami, fl": { lat: 25.7617, lng: -80.1918 },
  "miami": { lat: 25.7617, lng: -80.1918 },
  "atlanta, ga": { lat: 33.749, lng: -84.388 },
  "atlanta": { lat: 33.749, lng: -84.388 },
  "denver, co": { lat: 39.7392, lng: -104.9903 },
  "denver": { lat: 39.7392, lng: -104.9903 },
  "seattle, wa": { lat: 47.6062, lng: -122.3321 },
  "seattle": { lat: 47.6062, lng: -122.3321 },
  "las vegas, nv": { lat: 36.1699, lng: -115.1398 },
  "las vegas": { lat: 36.1699, lng: -115.1398 },
  "detroit, mi": { lat: 42.3314, lng: -83.0458 },
  "detroit": { lat: 42.3314, lng: -83.0458 },
  "austin, tx": { lat: 30.2672, lng: -97.7431 },
  "austin": { lat: 30.2672, lng: -97.7431 },
  "portland, or": { lat: 45.5051, lng: -122.675 },
  "portland": { lat: 45.5051, lng: -122.675 },
  "nashville, tn": { lat: 36.1627, lng: -86.7816 },
  "nashville": { lat: 36.1627, lng: -86.7816 },
  "charlotte, nc": { lat: 35.2271, lng: -80.8431 },
  "charlotte": { lat: 35.2271, lng: -80.8431 },
  "san francisco, ca": { lat: 37.7749, lng: -122.4194 },
  "san francisco": { lat: 37.7749, lng: -122.4194 },
  "san jose, ca": { lat: 37.3382, lng: -121.8863 },
  "san jose": { lat: 37.3382, lng: -121.8863 },
  "jacksonville, fl": { lat: 30.3322, lng: -81.6557 },
  "jacksonville": { lat: 30.3322, lng: -81.6557 },
  "columbus, oh": { lat: 39.9612, lng: -82.9988 },
  "columbus": { lat: 39.9612, lng: -82.9988 },
  "indianapolis, in": { lat: 39.7684, lng: -86.1581 },
  "indianapolis": { lat: 39.7684, lng: -86.1581 },
  "fort worth, tx": { lat: 32.7555, lng: -97.3308 },
  "fort worth": { lat: 32.7555, lng: -97.3308 },
  "memphis, tn": { lat: 35.1495, lng: -90.0490 },
  "memphis": { lat: 35.1495, lng: -90.0490 },
  "baltimore, md": { lat: 39.2904, lng: -76.6122 },
  "baltimore": { lat: 39.2904, lng: -76.6122 },
  "boston, ma": { lat: 42.3601, lng: -71.0589 },
  "boston": { lat: 42.3601, lng: -71.0589 },
  "louisville, ky": { lat: 38.2527, lng: -85.7585 },
  "louisville": { lat: 38.2527, lng: -85.7585 },
  "oklahoma city, ok": { lat: 35.4676, lng: -97.5164 },
  "oklahoma city": { lat: 35.4676, lng: -97.5164 },
  "minneapolis, mn": { lat: 44.9778, lng: -93.265 },
  "minneapolis": { lat: 44.9778, lng: -93.265 },
  "raleigh, nc": { lat: 35.7796, lng: -78.6382 },
  "raleigh": { lat: 35.7796, lng: -78.6382 },
  "tampa, fl": { lat: 27.9506, lng: -82.4572 },
  "tampa": { lat: 27.9506, lng: -82.4572 },
  "orlando, fl": { lat: 28.5383, lng: -81.3792 },
  "orlando": { lat: 28.5383, lng: -81.3792 },
  "sacramento, ca": { lat: 38.5816, lng: -121.4944 },
  "sacramento": { lat: 38.5816, lng: -121.4944 },
};

let lastNominatimCall = 0;

async function nominatimGeocode(query: string): Promise<{ lat: number; lng: number } | null> {
  // Respect Nominatim's 1 req/sec rate limit
  const now = Date.now();
  const wait = 1100 - (now - lastNominatimCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatimCall = Date.now();

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "CHASSII/1.0 (car meet finder app)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json() as Array<{ lat: string; lon: string }>;
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

export async function geocodeCity(query: string): Promise<{ lat: number; lng: number } | null> {
  const key = query.trim().toLowerCase();
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;

  // Fast path: known US cities — no network call needed
  const known = KNOWN_CITIES[key];
  if (known) {
    geocodeCache.set(key, known);
    return known;
  }

  const result = await nominatimGeocode(query);
  geocodeCache.set(key, result);
  return result;
}
