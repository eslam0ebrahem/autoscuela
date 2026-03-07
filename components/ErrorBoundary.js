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
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="text-5xl mb-4">😵</div>
            <h2 className="text-xl font-bold text-ink dark:text-white mb-2">
              {this.props.title || 'Something went wrong'}
            </h2>
            <p className="text-ink-light dark:text-slate-400 mb-6">
              {this.props.message || 'An unexpected error occurred. Please try again.'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                if (this.props.onReset) this.props.onReset()
              }}
              className="btn-primary"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
