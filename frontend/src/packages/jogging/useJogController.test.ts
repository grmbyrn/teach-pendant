import { act, renderHook } from '@testing-library/react'

import { robotActions } from '../../core/store/robotStore'

import { JOG_COMMAND_LATENCY_MS, type JogCommand } from './jogCommand'
import { useJogController } from './useJogController'

/** Put the store in the only state where jogging is allowed. */
const goLive = () => {
  robotActions.setConnectionStatus('connected')
  robotActions.setStale(false)
}

describe('useJogController', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    robotActions.reset()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('refuses to jog before any data has arrived', () => {
    const send = jest.fn<Promise<void>, [JogCommand]>().mockResolvedValue(undefined)
    const { result } = renderHook(() => useJogController({ send }))

    expect(result.current.canJog).toBe(false)

    act(() => result.current.jog('x', 1))

    // Boot state is disconnected and stale, so nothing may be sent.
    expect(send).not.toHaveBeenCalled()
  })

  it.each([
    ['disconnected and fresh', 'disconnected' as const, false],
    ['reconnecting and fresh', 'reconnecting' as const, false],
    ['connected but stale', 'connected' as const, true],
  ])('refuses to jog when %s', (_label, status, stale) => {
    const send = jest.fn<Promise<void>, [JogCommand]>().mockResolvedValue(undefined)
    robotActions.setConnectionStatus(status)
    robotActions.setStale(stale)

    const { result } = renderHook(() => useJogController({ send }))

    expect(result.current.canJog).toBe(false)
    act(() => result.current.jog('x', 1))
    expect(send).not.toHaveBeenCalled()
  })

  it('sends the command when connected and fresh', async () => {
    const send = jest.fn<Promise<void>, [JogCommand]>().mockResolvedValue(undefined)
    goLive()
    const { result } = renderHook(() => useJogController({ send }))

    expect(result.current.canJog).toBe(true)

    act(() => result.current.jog('y', -1))

    expect(send).toHaveBeenCalledWith({ axis: 'y', direction: -1 })
    expect(result.current.pending).toEqual({ axis: 'y', direction: -1 })
    expect(result.current.isPending('y', -1)).toBe(true)
    expect(result.current.isPending('y', 1)).toBe(false)
    // Busy counts as "cannot jog", so the buttons go disabled.
    expect(result.current.canJog).toBe(false)

    await act(async () => {
      await jest.advanceTimersByTimeAsync(JOG_COMMAND_LATENCY_MS)
    })

    expect(result.current.pending).toBeNull()
    expect(result.current.canJog).toBe(true)
  })

  it('ignores repeat taps in the same tick', async () => {
    const send = jest.fn<Promise<void>, [JogCommand]>().mockResolvedValue(undefined)
    goLive()
    const { result } = renderHook(() => useJogController({ send }))

    // The case a `pending` state check cannot catch: both taps happen before
    // React has re-rendered, so both would read `pending` as null. The ref
    // lock is what makes the second one a no-op.
    act(() => {
      result.current.jog('x', 1)
      result.current.jog('x', 1)
      result.current.jog('x', 1)
    })

    expect(send).toHaveBeenCalledTimes(1)

    // Let the command settle inside act, so its state update is accounted for.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(JOG_COMMAND_LATENCY_MS)
    })
  })

  it('ignores a different axis while a command is in flight', async () => {
    const send = jest.fn<Promise<void>, [JogCommand]>().mockResolvedValue(undefined)
    goLive()
    const { result } = renderHook(() => useJogController({ send }))

    act(() => result.current.jog('x', 1))
    act(() => result.current.jog('z', -1))

    // One motion instruction at a time, even on another axis.
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith({ axis: 'x', direction: 1 })

    await act(async () => {
      await jest.advanceTimersByTimeAsync(JOG_COMMAND_LATENCY_MS)
    })
  })

  it('re-checks liveness at the moment of the tap, not at last render', () => {
    const send = jest.fn<Promise<void>, [JogCommand]>().mockResolvedValue(undefined)
    goLive()
    const { result } = renderHook(() => useJogController({ send }))

    const jog = result.current.jog
    expect(result.current.canJog).toBe(true)

    // Data goes stale. We then call the callback captured *before* that
    // change - exactly the gap a throttled display opens up. If `jog` trusted
    // a closed-over `isLive` it would happily send; because it re-reads the
    // store, it refuses.
    act(() => {
      robotActions.setStale(true)
    })

    act(() => jog('x', 1))

    expect(send).not.toHaveBeenCalled()
  })

  it('clears pending and reports the message when a command fails', async () => {
    const send = jest
      .fn<Promise<void>, [JogCommand]>()
      .mockRejectedValue(new Error('robot refused: emergency stop active'))
    goLive()
    const { result } = renderHook(() => useJogController({ send }))

    act(() => result.current.jog('x', 1))
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0)
    })

    // A failure must not leave the button stuck pending - a hung-looking
    // button is what makes an operator start tapping.
    expect(result.current.pending).toBeNull()
    expect(result.current.canJog).toBe(true)
    expect(result.current.lastError).toBe('robot refused: emergency stop active')
  })

  it('clears a previous error when a new command starts', async () => {
    const send = jest
      .fn<Promise<void>, [JogCommand]>()
      .mockRejectedValueOnce(new Error('nope'))
      .mockResolvedValue(undefined)
    goLive()
    const { result } = renderHook(() => useJogController({ send }))

    act(() => result.current.jog('x', 1))
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0)
    })
    expect(result.current.lastError).toBe('nope')

    act(() => result.current.jog('x', 1))
    expect(result.current.lastError).toBeNull()

    await act(async () => {
      await jest.advanceTimersByTimeAsync(JOG_COMMAND_LATENCY_MS)
    })
    expect(result.current.lastError).toBeNull()
  })

  it('allows the next command once the first has settled', async () => {
    const send = jest.fn<Promise<void>, [JogCommand]>().mockResolvedValue(undefined)
    goLive()
    const { result } = renderHook(() => useJogController({ send }))

    act(() => result.current.jog('x', 1))
    await act(async () => {
      await jest.advanceTimersByTimeAsync(JOG_COMMAND_LATENCY_MS)
    })

    act(() => result.current.jog('x', -1))
    expect(send).toHaveBeenCalledTimes(2)
    expect(send).toHaveBeenLastCalledWith({ axis: 'x', direction: -1 })

    await act(async () => {
      await jest.advanceTimersByTimeAsync(JOG_COMMAND_LATENCY_MS)
    })
  })

  it('does not set state after unmount', async () => {
    const send = jest.fn<Promise<void>, [JogCommand]>().mockResolvedValue(undefined)
    goLive()
    const { result, unmount } = renderHook(() => useJogController({ send }))

    act(() => result.current.jog('x', 1))
    unmount()

    // Settling after the screen is gone must not throw or warn.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(JOG_COMMAND_LATENCY_MS)
    })

    expect(send).toHaveBeenCalledTimes(1)
  })
})
