import { Component, type ErrorInfo, type ReactNode } from 'react'
import { logError } from '../lib/errorLogging'

interface ErrorBoundaryProps {
    children: ReactNode
}

interface ErrorBoundaryState {
    hasError: boolean
}

/**
 * Catches render-time crashes anywhere below it so a thrown error shows an
 * on-brand page instead of React unmounting the tree and leaving a blank white
 * screen. Must be a class — React has no hook equivalent for componentDidCatch.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { hasError: false }

    static getDerivedStateFromError(): ErrorBoundaryState {
        return { hasError: true }
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        logError(error, {
            source: 'ErrorBoundary',
            componentStack: info.componentStack,
        })
    }

    render() {
        if (!this.state.hasError) return this.props.children

        return (
            <div className="page" style={{ textAlign: 'center' }}>
                <p className="mono-label muted" style={{ marginBottom: 'var(--space-4)' }}>
                    Error
                </p>
                <h1 style={{ marginBottom: 'var(--space-4)' }}>Something broke.</h1>
                <p className="muted" style={{ marginBottom: 'var(--space-6)' }}>
                    This one is on us, not you. Reloading usually clears it.
                </p>
                <button
                    type="button"
                    className="btn btn-primary mono-label"
                    onClick={() => window.location.assign('/')}
                >
                    Back to Safety →
                </button>
            </div>
        )
    }
}

export default ErrorBoundary
