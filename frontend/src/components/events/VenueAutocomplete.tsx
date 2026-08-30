import { useEffect, useRef, useState } from 'react'
import { searchPlaces, type PlaceSuggestion } from '../../lib/geocode'

export interface VenueValue {
  venue: string
  latitude: number | null
  longitude: number | null
}

interface VenueAutocompleteProps {
  value: VenueValue
  onChange: (next: VenueValue) => void
  error?: string
  disabled?: boolean
}

const DEBOUNCE_MS = 400

/**
 * Google-Maps-style venue picker. As the organiser types, place suggestions
 * from OpenStreetMap/Nominatim appear; selecting one fills the venue text and
 * captures its latitude/longitude. Editing the text by hand clears the
 * captured coordinates, since they would no longer match what was typed.
 */
export function VenueAutocomplete({ value, onChange, error, disabled }: VenueAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  // Set to the exact label of the last selected suggestion so a keystroke that
  // changes the field away from it can drop the now-stale coordinates.
  const selectedLabelRef = useRef<string | null>(value.venue || null)
  const containerRef = useRef<HTMLDivElement>(null)
  const skipNextSearchRef = useRef(false)

  useEffect(() => {
    function handleClickAway(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickAway)
    return () => document.removeEventListener('mousedown', handleClickAway)
  }, [])

  useEffect(() => {
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false
      return
    }

    const query = value.venue.trim()
    if (query.length < 3) {
      setSuggestions([])
      setLoading(false)
      setSearchError(null)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    const timer = window.setTimeout(async () => {
      try {
        const results = await searchPlaces(query, controller.signal)
        setSuggestions(results)
        setSearchError(null)
        setOpen(true)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setSearchError('Could not load place suggestions.')
          setSuggestions([])
        }
      } finally {
        setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [value.venue])

  function handleTextChange(text: string) {
    const stillMatchesSelection = text === selectedLabelRef.current
    onChange({
      venue: text,
      latitude: stillMatchesSelection ? value.latitude : null,
      longitude: stillMatchesSelection ? value.longitude : null,
    })
  }

  function handlePick(suggestion: PlaceSuggestion) {
    skipNextSearchRef.current = true
    selectedLabelRef.current = suggestion.label
    onChange({
      venue: suggestion.label,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    })
    setSuggestions([])
    setOpen(false)
  }

  const hasCoords = value.latitude !== null && value.longitude !== null

  return (
    <div className="flex flex-col gap-1" ref={containerRef}>
      <label htmlFor="venue" className="text-sm font-medium text-gray-700">
        Venue
      </label>
      <div className="relative">
        <input
          id="venue"
          name="venue"
          autoComplete="off"
          disabled={disabled}
          value={value.venue}
          onChange={(e) => handleTextChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="Search for a place…"
          className={`w-full border px-3 py-2 text-sm text-black placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-black disabled:bg-gray-50 disabled:text-gray-500 ${
            error ? 'border-gray-900' : 'border-gray-300'
          }`}
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">…</span>
        )}
        {open && suggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto border border-gray-300 bg-white shadow-lg">
            {suggestions.map((suggestion) => (
              <li key={suggestion.id}>
                <button
                  type="button"
                  onClick={() => handlePick(suggestion)}
                  className="block w-full px-3 py-2 text-left text-xs hover:bg-gray-100"
                >
                  <span className="font-medium text-black">{suggestion.name}</span>
                  <span className="block text-gray-500">{suggestion.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && <p className="text-xs text-gray-700">{error}</p>}
      {searchError && <p className="text-xs text-gray-500">{searchError}</p>}
      {hasCoords ? (
        <p className="text-xs text-gray-500">
          📍 {value.latitude!.toFixed(6)}, {value.longitude!.toFixed(6)}
        </p>
      ) : (
        value.venue.trim().length > 0 && (
          <p className="text-xs text-gray-400">Pick a suggestion to capture map coordinates.</p>
        )
      )}
    </div>
  )
}
