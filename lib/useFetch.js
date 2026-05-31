'use client'

import { useEffect, useRef } from 'react'

/**
 * Custom hook to manage fetch calls with AbortController
 * Automatically cancels fetch requests on component unmount
 *
 * Usage:
 *   const abortController = useFetch()
 *
 *   useEffect(() => {
 *     const fetchData = async () => {
 *       try {
 *         const res = await fetch('/api/data', {
 *           signal: abortController.current.signal
 *         })
 *         const data = await res.json()
 *       } catch (err) {
 *         if (err.name !== 'AbortError') {
 *           console.error('Fetch error:', err)
 *         }
 *       }
 *     }
 *     fetchData()
 *   }, [])
 */
export function useFetch() {
  const abortControllerRef = useRef(null)

  // Create a fresh AbortController on every call.
  // The previous pattern created it once on mount: once aborted (component
  // unmount), the same signal was reused for subsequent mounts / refetches,
  // causing all future fetch calls to silently fail with AbortError.
  const getSignal = () => {
    // Abort any in-flight request before creating a new one
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()
    return abortControllerRef.current.signal
  }

  useEffect(() => {
    // Ensure controller exists on mount
    if (!abortControllerRef.current) {
      abortControllerRef.current = new AbortController()
    }

    return () => {
      // Cancel all pending requests on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // Return both the ref (for backwards compatibility) and getSignal
  abortControllerRef.getSignal = getSignal
  return abortControllerRef
}

/**
 * Alternative: Hook that returns a function to create multiple abort controllers
 * Useful for multiple independent fetch calls
 */
export function useFetchAbort() {
  const controllersRef = useRef([])

  useEffect(() => {
    return () => {
      // Abort all stored controllers on unmount
      controllersRef.current.forEach((controller) => controller.abort())
      controllersRef.current = []
    }
  }, [])

  const createController = () => {
    const controller = new AbortController()
    controllersRef.current.push(controller)
    return controller
  }

  return { createController }
}
