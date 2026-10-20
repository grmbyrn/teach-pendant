import { RouterProvider, createMemoryRouter } from 'react-router-dom'

import { renderWithProviders, screen } from '../test/renderWithProviders'
import { routes } from './router'

// The shell now mounts the live stream and the watchdog. This file is about
// routing and layout, so both are stubbed out - otherwise every assertion
// here would be racing a 50 Hz timer. Each has its own tests.
jest.mock('../core/stream/usePositionStream', () => ({ usePositionStream: () => {} }))
jest.mock('../core/watchdog/useStaleWatchdog', () => ({ useStaleWatchdog: () => {} }))

/**
 * A wiring test, not a behaviour test. It proves the whole step-1 toolchain
 * holds together: TypeScript compiles under ts-jest, Griffel styles resolve,
 * Fluent gets its theme, and the real route table resolves a lazy feature.
 *
 * It mounts `routes` - the same array the app uses - in a memory router, so
 * the app and the test can never disagree about the route table.
 */
describe('AppShell', () => {
  it('renders the shell and navigation', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/monitoring'] })
    renderWithProviders(<RouterProvider router={router} />)

    // The status bar renders the connection state; boot state is disconnected.
    expect(await screen.findByText('Disconnected')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Monitoring' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Jogging' })).toBeInTheDocument()
  })

  it('loads the lazy monitoring feature for /monitoring', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/monitoring'] })
    renderWithProviders(<RouterProvider router={router} />)

    // findBy* waits: the feature arrives on a later tick via dynamic import.
    expect(await screen.findByRole('heading', { name: 'Tool position' })).toBeInTheDocument()
  })

  it('redirects an unknown route to monitoring instead of showing nothing', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/nope'] })
    renderWithProviders(<RouterProvider router={router} />)

    expect(await screen.findByRole('heading', { name: 'Tool position' })).toBeInTheDocument()
  })
})
