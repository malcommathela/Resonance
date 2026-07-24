import React from 'react'
import * as Sentry from '@sentry/react'
import { Button } from "@/components/ui/Button";

/**
 * L12: React Error Boundary with Sentry reporting.
 * Catches render-phase errors, reports to Sentry, and shows a fallback UI.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, eventId: null }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    Sentry.withScope((scope) => {
      scope.setExtras(errorInfo)
      const eventId = Sentry.captureException(error)
      this.setState({ eventId })
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 p-8 text-center text-white">
          <h1 className="mb-4 text-3xl font-bold">Something went wrong</h1>
          <p className="mb-6 max-w-md text-gray-400">
            Our team has been notified. Please try refreshing the page.
          </p>
          {this.state.eventId && (
            <p className="mb-6 font-mono text-xs text-gray-500">
              Error ID: {this.state.eventId}
            </p>
          )}
          <Button onClick={() => window.location.reload()}>Reload Page</Button>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
