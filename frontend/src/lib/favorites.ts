import { useCallback, useEffect, useState } from 'react'

// Per-browser "saved events" — purely local, no backend. Stored as a JSON
// number[] under one key; a custom window event keeps cards in the same tab
// in sync (the native `storage` event only fires in *other* tabs).
const KEY = 'eventpro_favorites'
const SYNC_EVENT = 'eventpro:favorites'

function read(): number[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(raw) ? raw.filter((n): n is number => typeof n === 'number') : []
  } catch {
    return []
  }
}

function write(ids: number[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids))
  } catch {
    // Private mode / storage disabled — favourites just won't persist.
  }
  window.dispatchEvent(new Event(SYNC_EVENT))
}

export function getFavoriteIds(): number[] {
  return read()
}

export function isFavorite(id: number): boolean {
  return read().includes(id)
}

export function toggleFavorite(id: number): boolean {
  const ids = read()
  const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
  write(next)
  return next.includes(id)
}

interface ToggleEventLike {
  preventDefault(): void
  stopPropagation(): void
}

export function useFavorite(id: number): { fav: boolean; toggle: (e?: ToggleEventLike) => void } {
  const [fav, setFav] = useState(() => isFavorite(id))

  useEffect(() => {
    const sync = () => setFav(isFavorite(id))
    sync()
    window.addEventListener('storage', sync)
    window.addEventListener(SYNC_EVENT, sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener(SYNC_EVENT, sync)
    }
  }, [id])

  const toggle = useCallback(
    (e?: ToggleEventLike) => {
      e?.preventDefault()
      e?.stopPropagation()
      setFav(toggleFavorite(id))
    },
    [id],
  )

  return { fav, toggle }
}
