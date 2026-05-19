const geocodeCache = new Map<string, { lat: number; lng: number } | null>();

export async function geocodeCity(query: string): Promise<{ lat: number; lng: number } | null> {
  const key = query.trim().toLowerCase();
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "CHASSII/1.0 (car meet finder app)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      geocodeCache.set(key, null);
      return null;
    }
    const data = await res.json() as Array<{ lat: string; lon: string }>;
    if (!data.length) {
      geocodeCache.set(key, null);
      return null;
    }
    const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    geocodeCache.set(key, result);
    return result;
  } catch {
    geocodeCache.set(key, null);
    return null;
  }
}
