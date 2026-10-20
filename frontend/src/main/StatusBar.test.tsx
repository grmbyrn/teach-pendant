import { act } from '@testing-library/react'

import { robotActions } from '../core/store/robotStore'
import { STALE_AFTER_MS, startStaleWatchdog } from '../core/watchdog/staleWatchdog'
import { renderWithProviders, screen } from '../test/renderWithProviders'

import { StatusBar } from './StatusBar'

const WARNING = 'Data not up to date'

let timestamp = 0
const sendSample = () => {
  timestamp += 20
  robotActions.applySample({ x: 1, y: 2, z: 3, timestamp })
}

describe('StatusBar', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    robotActions.reset()
    timestamp = 0
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('shows the connection state in plain language', () => {
    renderWithProviders(<StatusBar />)
    expect(screen.getByText('Disconnected')).toBeInTheDocument()

    // retryAttempt 0 means we have never connected, so "reconnecting" would
    // be a lie even though it is the same status value.
    act(() => {
      robotActions.setConnectionStatus('reconnecting')
    })
    expect(screen.getByText('Connecting…')).toBeInTheDocument()

    act(() => {
      robotActions.setRetryAttempt(3)
    })
    expect(screen.getByText('Reconnecting — attempt 3 of 6')).toBeInTheDocument()

    act(() => {
      robotActions.setConnectionStatus('connected')
      robotActions.setRetryAttempt(0)
    })
    expect(screen.getByText('Connected')).toBeInTheDocument()
  })

  it('warns after 1 s without messages and stops warning when data resumes', () => {
    const stop = startStaleWatchdog()
    renderWithProviders(<StatusBar />)

    act(() => {
      robotActions.setConnectionStatus('connected')
      sendSample()
    })
    expect(screen.queryByText(WARNING)).not.toBeInTheDocument()

    // Just short of the deadline: still trusted, no warning.
    act(() => {
      jest.advanceTimersByTime(STALE_AFTER_MS - 1)
    })
    expect(screen.queryByText(WARNING)).not.toBeInTheDocument()

    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(screen.getByText(WARNING)).toBeInTheDocument()

    // And it clears the moment real data comes back.
    act(() => {
      sendSample()
    })
    expect(screen.queryByText(WARNING)).not.toBeInTheDocument()

    stop()
  })

  it('still warns while disconnected, because the data is old either way', () => {
    renderWithProviders(<StatusBar />)

    act(() => {
      robotActions.setConnectionStatus('disconnected')
      robotActions.setStale(true)
    })

    expect(screen.getByText('Disconnected')).toBeInTheDocument()
    expect(screen.getByText(WARNING)).toBeInTheDocument()
  })
})
