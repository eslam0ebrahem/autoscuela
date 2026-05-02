'use client'

import { useEffect, useRef } from 'react'

/**
 * useFocusTrap Hook
 *
 * Traps focus within a modal/dialog element.
 * Useful for accessibility on mobile menus and modals.
 *
 * @param {boolean} isActive - Whether the focus trap should be active
 * @param {string} [triggerSelector] - Optional selector for the element that opened the trap
 * @returns {object} - { ref: ref to apply to container }
 */
export function useFocusTrap(isActive) {
  const containerRef = useRef(null)
  const previousActiveElementRef = useRef(null)

  useEffect(() => {
    if (!isActive || !containerRef.current) return

    // Store the previously focused element so we can restore it on close
    previousActiveElementRef.current = document.activeElement

    // Find all focusable elements within the container
    const getFocusableElements = () => {
      const focusableSelectors = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(',')

      return containerRef.current?.querySelectorAll(focusableSelectors) || []
    }

    // Focus the first element on open
    const focusableElements = getFocusableElements()
    if (focusableElements.length > 0) {
      focusableElements[0].focus()
    }

    // Handle tab key to trap focus
    const handleKeyDown = (e) => {
      if (e.key !== 'Tab') return

      const focusableElements = getFocusableElements()
      if (focusableElements.length === 0) return

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]
      const activeElement = document.activeElement

      // Shift + Tab on first element -> focus last
      if (e.shiftKey && activeElement === firstElement) {
        e.preventDefault()
        lastElement.focus()
      }
      // Tab on last element -> focus first
      else if (!e.shiftKey && activeElement === lastElement) {
        e.preventDefault()
        firstElement.focus()
      }
    }

    containerRef.current.addEventListener('keydown', handleKeyDown)

    return () => {
      containerRef.current?.removeEventListener('keydown', handleKeyDown)
      // Restore focus to the trigger element on close
      if (previousActiveElementRef.current?.focus) {
        previousActiveElementRef.current.focus()
      }
    }
  }, [isActive])

  return { ref: containerRef }
}
