// Place lookup backed by OpenStreetMap's Nominatim service. No API key or
// billing required; usage policy asks for <=1 request/second, so callers
// must debounce (see VenueAutocomplete). Nominatim sends
// `Access-Control-Allow-Origin: *`, so it is callable directly from the browser.

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

export interface PlaceSuggestion {
  /** Nominatim place id, stable enough to use as a React key. */
  id: number
  /** Full human-readable address, e.g. "Eiffel Tower, Paris, France". */
  label: string
  /** Short leading label, e.g. "Eiffel Tower". */
  name: string
  latitude: number
  longitude: number
}

interface NominatimResult {
  place_id: number
  display_name: string
  name?: string
  lat: string
  lon: string
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim()
  if (trimmed.length < 3) return []

  const params = new URLSearchParams({
    q: trimmed,
    format: 'jsonv2',
    addressdetails: '0',
    limit: '6',
  })

  const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
    signal,
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Place search failed (${response.status})`)
  }

  const results = (await response.json()) as NominatimResult[]

  return results.map((result) => ({
    id: result.place_id,
    label: result.display_name,
    name: result.name?.trim() || result.display_name.split(',')[0]!.trim(),
    latitude: Number(result.lat),
    longitude: Number(result.lon),
  }))
}
