import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ErrorBoundary from '../ErrorBoundary'
import NotFound from '../NotFound'

function Boom(): never {
    throw new Error('kaboom')
}

let consoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
    // React logs caught errors itself; silence it so the run stays readable.
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
    consoleError.mockRestore()
})

describe('ErrorBoundary', () => {
    test('renders children when nothing throws', () => {
        render(
            <ErrorBoundary>
                <p>All good</p>
            </ErrorBoundary>
        )

        expect(screen.getByText('All good')).toBeInTheDocument()
    })

    test('shows an on-brand fallback instead of a blank screen when a child throws', () => {
        render(
            <ErrorBoundary>
                <Boom />
            </ErrorBoundary>
        )

        expect(screen.getByText('Something broke.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /back to safety/i })).toBeInTheDocument()
    })

    test('reports the error through the logging funnel', () => {
        render(
            <ErrorBoundary>
                <Boom />
            </ErrorBoundary>
        )

        expect(consoleError).toHaveBeenCalledWith(
            '[livepoll]',
            expect.objectContaining({ message: 'kaboom', source: 'ErrorBoundary' })
        )
    })
})

describe('NotFound', () => {
    test('offers a route back to the app', () => {
        render(
            <MemoryRouter>
                <NotFound />
            </MemoryRouter>
        )

        expect(screen.getByText('Nothing lives here.')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /go to livepoll/i })).toHaveAttribute('href', '/')
    })
})
