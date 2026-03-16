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

  useEffect(() => {
    // Create a new AbortController for this component
    abortControllerRef.current = new AbortController()

    return () => {
      // Cancel all pending requests on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

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
