import React from 'react'

/**
 * A lightweight component to render simple markdown-style bold text (**text**)
 * without needing a full markdown parser.
 */
export default function FormattedText({ text, className = '' }) {
  if (!text) return null
  if (typeof text !== 'string') return <>{text}</>

  // Split by **...**
  // The regex /(\*\*.*?\*\*)/g captures the bold segments including the asterisks
  const parts = text.split(/(\*\*.*?\*\*)/g)

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
          return <strong key={index}>{part.slice(2, -2)}</strong>
        }
        return <React.Fragment key={index}>{part}</React.Fragment>
      })}
    </span>
  )
}
