import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'

export { useApi, useMutation } from './useApi'

/** Debounce a fast-changing value (search boxes). */
export function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

/** Page state plus helpers, reset whenever filters change. */
export function usePagination(initialPerPage = 20) {
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(initialPerPage)
  const reset = useCallback(() => setPage(1), [])
  return { page, perPage, setPage, setPerPage, reset }
}

/**
 * Tailwind-aligned media query hook (mobile drawer vs fixed sidebar).
 *
 * Uses `useSyncExternalStore` so the match is read during render rather than
 * synchronised through an effect.
 */
export function useMediaQuery(query) {
  const subscribe = useCallback(
    (onStoreChange) => {
      if (typeof window === 'undefined') return () => {}
      const list = window.matchMedia(query)
      list.addEventListener('change', onStoreChange)
      return () => list.removeEventListener('change', onStoreChange)
    },
    [query],
  )
  const getSnapshot = useCallback(
    () => (typeof window === 'undefined' ? false : window.matchMedia(query).matches),
    [query],
  )
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)')

/** Close a drawer/menu on Escape. */
export function useEscapeKey(handler, active = true) {
  useEffect(() => {
    if (!active) return undefined
    const listener = (event) => {
      if (event.key === 'Escape') handler()
    }
    document.addEventListener('keydown', listener)
    return () => document.removeEventListener('keydown', listener)
  }, [handler, active])
}

/** Lock body scroll while a modal or drawer is open. */
export function useBodyScrollLock(locked) {
  useEffect(() => {
    if (!locked) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [locked])
}

/** Simple boolean toggle with stable callbacks (modals, drawers). */
export function useToggle(initial = false) {
  const [value, setValue] = useState(initial)
  const open = useCallback(() => setValue(true), [])
  const close = useCallback(() => setValue(false), [])
  const toggle = useCallback(() => setValue((current) => !current), [])
  return useMemo(() => ({ value, open, close, toggle, setValue }), [value, open, close, toggle])
}

/** The year/month pair used by calendars and monthly reports. */
export function useMonthSelection(initial = new Date()) {
  const [year, setYear] = useState(initial.getFullYear())
  const [month, setMonth] = useState(initial.getMonth() + 1)

  const goPrevious = useCallback(() => {
    setMonth((currentMonth) => {
      if (currentMonth === 1) {
        setYear((currentYear) => currentYear - 1)
        return 12
      }
      return currentMonth - 1
    })
  }, [])

  const goNext = useCallback(() => {
    setMonth((currentMonth) => {
      if (currentMonth === 12) {
        setYear((currentYear) => currentYear + 1)
        return 1
      }
      return currentMonth + 1
    })
  }, [])

  return { year, month, setYear, setMonth, goPrevious, goNext }
}
