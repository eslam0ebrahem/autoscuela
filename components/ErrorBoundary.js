'use client'

import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-[50vh] flex items-center justify-center px-4">
        <div
          className="w-full max-w-sm rounded-3xl border border-error/20 bg-base-100
          shadow-sm overflow-hidden text-center"
        >
          {/* Red top strip */}
          <div className="h-1.5 bg-gradient-to-r from-error/60 via-error to-error/60" />

          <div className="p-8 space-y-4">
            <div
              className="w-14 h-14 rounded-2xl bg-error/10 border border-error/20
              flex items-center justify-center text-2xl mx-auto"
            >
              ⚠️
            </div>

            <div>
              <h2 className="text-lg font-black text-base-content">Algo salió mal</h2>
              <p className="text-sm text-base-content/50 mt-1.5 leading-relaxed">
                {this.props.message ||
                  'Ha ocurrido un error inesperado en esta sección. Por favor, inténtalo de nuevo.'}
              </p>
            </div>

            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
              className="btn btn-error btn-sm w-full rounded-xl h-11 font-bold"
            >
              🔄 Reintentar
            </button>

            {/* Dev-only stack trace */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="text-left mt-2">
                <summary className="text-xs font-bold text-base-content/40 cursor-pointer hover:text-base-content/60">
                  Stack trace (dev only)
                </summary>
                <pre
                  className="mt-2 p-3 rounded-xl bg-base-200 text-[10px] text-error/80
                  overflow-auto max-h-40 leading-relaxed whitespace-pre-wrap"
                >
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      </div>
    )
  }
}
