import { useState, useRef, useCallback } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL

export function useUserSearch({ canSearch = true, minQueryLength = 1, debounceMs = 250 } = {}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef(null)

  const clear = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    setQuery('')
    setResults([])
    setLoading(false)
  }, [])

  const search = useCallback((value) => {
    setQuery(value)
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    const trimmed = value.trim()
    if (!canSearch || !API) {
      setLoading(false)
      setResults([])
      return
    }

    if (trimmed.length < minQueryLength) {
      setLoading(false)
      setResults([])
      return
    }

    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/users/search?q=${encodeURIComponent(trimmed)}&limit=8`, {
          credentials: 'include',
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(data?.message || res.statusText)
        }
        setResults(Array.isArray(data.users) ? data.users : [])
      } catch (err) {
        console.error('[useUserSearch] search error:', err)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, debounceMs)
  }, [API, canSearch, debounceMs, minQueryLength])

  return {
    query,
    results,
    loading,
    search,
    clear,
  }
}
