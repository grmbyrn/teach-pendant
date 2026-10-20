import { act } from '@testing-library/react'

import { robotActions } from '../../core/store/robotStore'
import { renderWithProviders, screen } from '../../test/renderWithProviders'

import { JOG_COMMAND_LATENCY_MS } from './jogCommand'
import { JogButtons } from './JogButtons'

const allButtons = () => screen.getAllByRole('button')
const plusX = () => screen.getByRole('button', { name: 'X +' })

const goLive = () => {
  act(() => {
    robotActions.setConnectionStatus('connected')
    robotActions.setStale(false)
  })
}

describe('JogButtons', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    robotActions.reset()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders a button per axis and direction, all large enough to tap', () => {
    renderWithProviders(<JogButtons />)
    expect(allButtons()).toHaveLength(6)
  })

  it('is disabled before any data has arrived', () => {
    renderWithProviders(<JogButtons />)

    // Boot state: disconnected and stale. Nothing is tappable.
    for (const button of allButtons()) expect(button).toBeDisabled()
    expect(screen.getByText('Jogging is unavailable until live data resumes.')).toBeInTheDocument()
  })

  it('is disabled when connected but stale', () => {
    renderWithProviders(<JogButtons />)

    act(() => {
      robotActions.setConnectionStatus('connected')
      robotActions.setStale(true)
    })

    // The link being up is not enough - the data has to be current.
    for (const button of allButtons()) expect(button).toBeDisabled()
  })

  it.each(['reconnecting', 'disconnected'] as const)(
    'is disabled when %s even with fresh data',
    (status) => {
      renderWithProviders(<JogButtons />)

      act(() => {
        robotActions.setConnectionStatus(status)
        robotActions.setStale(false)
      })

      for (const button of allButtons()) expect(button).toBeDisabled()
    },
  )

  it('is enabled only when connected and fresh', () => {
    renderWithProviders(<JogButtons />)
    goLive()

    for (const button of allButtons()) expect(button).toBeEnabled()
    expect(
      screen.queryByText('Jogging is unavailable until live data resumes.'),
    ).not.toBeInTheDocument()
  })

  it('goes pending on tap, blocks every button, then recovers', async () => {
    renderWithProviders(<JogButtons />)
    goLive()

    act(() => {
      plusX().click()
    })

    // One command in flight means no second command, on any axis.
    for (const button of allButtons()) expect(button).toBeDisabled()
    expect(
      screen.getByText('Waiting for the robot to acknowledge the last move…'),
    ).toBeInTheDocument()

    await act(async () => {
      await jest.advanceTimersByTimeAsync(JOG_COMMAND_LATENCY_MS)
    })

    for (const button of allButtons()) expect(button).toBeEnabled()
  })

  it('becomes disabled mid-move if the data goes stale', async () => {
    renderWithProviders(<JogButtons />)
    goLive()

    act(() => {
      plusX().click()
    })

    // The command is acknowledged, but meanwhile the stream went quiet. The
    // operator must not get the buttons back just because the move finished.
    act(() => {
      robotActions.setStale(true)
    })

    await act(async () => {
      await jest.advanceTimersByTimeAsync(JOG_COMMAND_LATENCY_MS)
    })

    for (const button of allButtons()) expect(button).toBeDisabled()
  })
})
