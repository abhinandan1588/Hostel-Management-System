import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Data fetching with explicit loading / error / empty states and a retry.
 *
 * `fetcher` must be a stable callback (wrap it in useCallback) returning a
 * promise. Every page uses this so no screen ever renders blank.
 */
export function useApi(fetcher, { immediate = true, initialData = null, onSuccess } = {}) {
  const [data, setData] = useState(initialData)
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(immediate)
  const [error, setError] = useState(null)
  const mounted = useRef(true)
  const requestId = useRef(0)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const run = useCallback(
    async ({ quiet = false, initial = false } = {}) => {
      const id = ++requestId.current
      // On the very first fetch `loading` already starts at `immediate` and
      // `error` is already null, so nothing is set synchronously. That keeps the
      // mount effect free of synchronous state updates.
      if (!quiet && !initial) setLoading(true)
      if (!initial) setError(null)
      try {
        const result = await fetcher()
        if (!mounted.current || id !== requestId.current) return null
        // Services that call getPage() return { data, meta }.
        if (result && typeof result === 'object' && 'data' in result && 'meta' in result) {
          setData(result.data)
          setMeta(result.meta)
        } else {
          setData(result)
          setMeta(null)
        }
        onSuccess?.(result)
        return result
      } catch (err) {
        if (!mounted.current || id !== requestId.current) return null
        if (!err.cancelled) setError(err)
        return null
      } finally {
        if (mounted.current && id === requestId.current) setLoading(false)
      }
    },
    [fetcher, onSuccess],
  )

  useEffect(() => {
    // Fetching is exactly the "synchronise with an external system" case the
    // rule carves out; the initial call sets no state synchronously (see `run`).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (immediate) run({ initial: true })
  }, [immediate, run])

  return {
    data,
    meta,
    loading,
    error,
    /** Re-fetch showing the loading state. */
    reload: run,
    /** Re-fetch without flashing the loading state (after a mutation). */
    refresh: useCallback(() => run({ quiet: true }), [run]),
    setData,
  }
}

/** Track an in-flight mutation so buttons can disable themselves. */
export function useMutation(mutator, { onSuccess, onError } = {}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const mutate = useCallback(
    async (...args) => {
      setSubmitting(true)
      setError(null)
      try {
        const result = await mutator(...args)
        onSuccess?.(result)
        return { ok: true, result }
      } catch (err) {
        setError(err)
        onError?.(err)
        return { ok: false, error: err }
      } finally {
        setSubmitting(false)
      }
    },
    [mutator, onSuccess, onError],
  )

  return { mutate, submitting, error }
}

export default useApi
