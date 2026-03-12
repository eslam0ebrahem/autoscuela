'use client'

import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service (e.g., Sentry) here
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6 animate-fade-in">
          <div className="card bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl max-w-md w-full text-center py-10 px-6 sm:px-8 animate-scale-in">
            
            <div className="text-6xl mb-6" aria-hidden="true">🛠️</div>
            
            <h2 className="text-2xl font-bold text-ink dark:text-white mb-3">
              {this.props.title || 'Algo salió mal / Something went wrong'}
            </h2>
            
            <p className="text-ink-light dark:text-slate-400 mb-8 leading-relaxed text-sm">
              {this.props.message || 'Ha ocurrido un error inesperado en esta sección. Por favor, inténtalo de nuevo.'}
            </p>

            {/* Dev-Mode Error Trace (Only shows on localhost during development) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-8 text-left p-3 bg-red-50 dark:bg-red-900/20 rounded-lg overflow-auto max-h-32 text-xs font-mono text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/50">
                <strong>Dev Error Trace:</strong><br/>
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null })
                  if (this.props.onReset) this.props.onReset()
                }}
                className="btn-primary flex-1 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-slate-800"
              >
                Reintentar / Try again
              </button>
              
              {/* Hard Reload Fallback */}
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-6 py-3 rounded-xl font-bold text-ink dark:text-white bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex-1 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
              >
                Recargar / Reload
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}