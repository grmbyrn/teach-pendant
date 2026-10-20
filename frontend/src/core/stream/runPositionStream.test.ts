import { useRobotStore } from '../store/robotStore'
import type { PositionSample } from '../types/robot'

import { StreamDroppedError } from './errors'
import { runPositionStream } from './runPositionStream'
import { sleep } from './sleep'

/**
 * A stream factory we can script, so each test decides exactly how many
 * samples arrive and how the connection ends.
 *
 * `subscribeCount` is the key assertion in most of these tests: it tells us
 * how many times the loop actually re-subscribed.
 */
function scriptedStream(scripts: Array<{ samples: number; then: 'drop' | 'hang' | 'bug' }>) {
  let subscribeCount = 0

  const factory = ({ signal }: { signal: AbortSignal }) => {
    const index = subscribeCount
    subscribeCount += 1
    // Past the end of the script, behave like the last entry.
    const script = scripts[Math.min(index, scripts.length - 1)] ?? { samples: 0, then: 'hang' }

    return (async function* (): AsyncGenerator<PositionSample, void, void> {
      for (let i = 0; i < script.samples; i++) {
        yield { x: index, y: i, z: 0, timestamp: index * 1000 + i }
      }

      if (script.then === 'drop') throw new StreamDroppedError()
      if (script.then === 'bug') throw new TypeError('undefined is not a function')

      // 'hang': stay open and silent, like a healthy but quiet backend.
      await sleep(10 ** 9, signal)
    })()
  }

  return { factory, get subscribeCount() { return subscribeCount } }
}

const state = () => useRobotStore.getState()

describe('runPositionStream', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    useRobotStore.getState().reset()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('reports connected only once a sample has actually arrived', async () => {
    const { factory } = scriptedStream([{ samples: 1, then: 'hang' }])
    const controller = new AbortController()

    const run = runPositionStream({
      signal: controller.signal,
      stream: factory,
      actions: {
        applySample: () => {
          // Checked at the moment the first sample is applied: the status must
          // already be 'connected', set by arrival rather than by subscribing.
          expect(state().connectionStatus).toBe('connected')
        },
        setConnectionStatus: useRobotStore.getState().setConnectionStatus,
        setRetryAttempt: useRobotStore.getState().setRetryAttempt,
      },
    })

    await jest.advanceTimersByTimeAsync(0)
    expect(state().connectionStatus).toBe('connected')
    expect(state().retryAttempt).toBe(0)

    controller.abort()
    await run
  })

  it('waits the backoff delay before re-subscribing after a drop', async () => {
    const script = scriptedStream([
      { samples: 1, then: 'drop' },
      { samples: 1, then: 'hang' },
    ])
    const controller = new AbortController()

    const run = runPositionStream({
      signal: controller.signal,
      stream: script.factory,
      delayFor: () => 500,
    })

    await jest.advanceTimersByTimeAsync(0)
    // Dropped: one subscription so far, and we are counting down to the next.
    expect(script.subscribeCount).toBe(1)
    expect(state().connectionStatus).toBe('reconnecting')
    expect(state().retryAttempt).toBe(1)

    // Still waiting just before the delay elapses - it does not retry eagerly.
    await jest.advanceTimersByTimeAsync(499)
    expect(script.subscribeCount).toBe(1)

    await jest.advanceTimersByTimeAsync(1)
    expect(script.subscribeCount).toBe(2)

    controller.abort()
    await run
  })

  it('asks for a longer delay on each successive failure', async () => {
    const script = scriptedStream([{ samples: 0, then: 'drop' }])
    const controller = new AbortController()
    const requested: number[] = []

    const run = runPositionStream({
      signal: controller.signal,
      stream: script.factory,
      maxAttempts: 4,
      delayFor: (attempt) => {
        requested.push(attempt)
        return 10
      },
    })

    await jest.advanceTimersByTimeAsync(1000)

    // The loop hands the real policy an increasing attempt number - that is
    // the contract between this loop and backoffDelay.
    expect(requested).toEqual([1, 2, 3, 4])

    controller.abort()
    await run
  })

  it('resets the ladder after a successful reconnection', async () => {
    const script = scriptedStream([
      { samples: 0, then: 'drop' },
      { samples: 0, then: 'drop' },
      { samples: 1, then: 'drop' },
      { samples: 1, then: 'hang' },
    ])
    const controller = new AbortController()
    const requested: number[] = []

    const run = runPositionStream({
      signal: controller.signal,
      stream: script.factory,
      delayFor: (attempt) => {
        requested.push(attempt)
        return 10
      },
    })

    await jest.advanceTimersByTimeAsync(1000)

    // Two failures (1, 2), then a connection that delivered data, then a
    // further drop which starts again from 1 rather than continuing at 3.
    expect(requested).toEqual([1, 2, 1])
    expect(state().connectionStatus).toBe('connected')
    expect(state().retryAttempt).toBe(0)

    controller.abort()
    await run
  })

  it('gives up and reports disconnected after the attempt limit', async () => {
    const script = scriptedStream([{ samples: 0, then: 'drop' }])
    const controller = new AbortController()

    const run = runPositionStream({
      signal: controller.signal,
      stream: script.factory,
      maxAttempts: 3,
      delayFor: () => 10,
    })

    await jest.advanceTimersByTimeAsync(1000)
    await run

    // 1 initial attempt + 3 retries, then it stops for good.
    expect(script.subscribeCount).toBe(4)
    expect(state().connectionStatus).toBe('disconnected')

    // And it really has stopped - more time changes nothing.
    await jest.advanceTimersByTimeAsync(60_000)
    expect(script.subscribeCount).toBe(4)
  })

  it('does not reconnect when the stream was cancelled on purpose', async () => {
    const script = scriptedStream([{ samples: 1, then: 'hang' }])
    const controller = new AbortController()

    const run = runPositionStream({
      signal: controller.signal,
      stream: script.factory,
      delayFor: () => 10,
    })

    await jest.advanceTimersByTimeAsync(0)
    controller.abort()
    await jest.advanceTimersByTimeAsync(60_000)
    await run

    // The whole point of abort-ends-cleanly: one subscription, no retry.
    expect(script.subscribeCount).toBe(1)
  })

  it('does not retry an unexpected error, and surfaces it', async () => {
    const script = scriptedStream([{ samples: 0, then: 'bug' }])
    const controller = new AbortController()
    const onError = jest.fn()

    const run = runPositionStream({
      signal: controller.signal,
      stream: script.factory,
      delayFor: () => 10,
      onError,
    })

    await jest.advanceTimersByTimeAsync(1000)
    await run

    // A programming error is not a connection problem, so backing off would
    // just hide it. Fail safe, and report.
    expect(onError).toHaveBeenCalledWith(expect.any(TypeError))
    expect(script.subscribeCount).toBe(1)
    expect(state().connectionStatus).toBe('disconnected')
  })

  it('writes every sample into the store', async () => {
    const { factory } = scriptedStream([{ samples: 3, then: 'hang' }])
    const controller = new AbortController()

    const run = runPositionStream({ signal: controller.signal, stream: factory })

    await jest.advanceTimersByTimeAsync(0)

    // Last of the three samples wins, with its own timestamp.
    expect(state().position).toEqual({ x: 0, y: 2, z: 0 })
    expect(state().lastUpdatedAt).toBe(2)

    controller.abort()
    await run
  })
})
