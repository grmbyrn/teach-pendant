import { robotActions, useRobotStore } from '../store/robotStore'

import { STALE_AFTER_MS, startStaleWatchdog } from './staleWatchdog'

const stale = () => useRobotStore.getState().stale

/** Push a sample in with an explicit timestamp, as the stream would. */
let nextTimestamp = 1
const sendSample = () => {
  nextTimestamp += 20
  robotActions.applySample({ x: 1, y: 2, z: 3, timestamp: nextTimestamp })
}

describe('startStaleWatchdog', () => {
  let stop: () => void

  beforeEach(() => {
    jest.useFakeTimers()
    robotActions.reset()
    nextTimestamp = 1
    stop = startStaleWatchdog()
  })

  afterEach(() => {
    stop()
    jest.useRealTimers()
  })

  it('clears stale as soon as data arrives', () => {
    // Boot state is stale: we have no data, so nothing can be trusted.
    expect(stale()).toBe(true)

    sendSample()
    expect(stale()).toBe(false)
  })

  it('marks data stale after exactly one second of silence', () => {
    sendSample()
    expect(stale()).toBe(false)

    // Still live right up to the deadline - no early warning.
    jest.advanceTimersByTime(STALE_AFTER_MS - 1)
    expect(stale()).toBe(false)

    jest.advanceTimersByTime(1)
    expect(stale()).toBe(true)
  })

  it('stays fresh while samples keep arriving', () => {
    sendSample()

    // 50 samples at 20 ms is a second of healthy streaming. The deadline is
    // pushed back each time, so it must never fire.
    for (let i = 0; i < 50; i++) {
      jest.advanceTimersByTime(20)
      sendSample()
      expect(stale()).toBe(false)
    }

    // Stop sending, and now it does.
    jest.advanceTimersByTime(STALE_AFTER_MS)
    expect(stale()).toBe(true)
  })

  it('recovers when data resumes', () => {
    sendSample()
    jest.advanceTimersByTime(STALE_AFTER_MS)
    expect(stale()).toBe(true)

    sendSample()
    expect(stale()).toBe(false)

    // And the clock is running again from the new sample.
    jest.advanceTimersByTime(STALE_AFTER_MS)
    expect(stale()).toBe(true)
  })

  it('writes `stale` only on a transition, not on every sample', () => {
    // Count the writes through the injected setter, still forwarding to the
    // real store so the rest of the behaviour is unchanged. Counting store
    // *notifications* would over-report: the watchdog writes from inside a
    // store subscription, and Zustand re-reports that transition to any
    // listener running after ours. See the note in staleWatchdog.ts.
    const writes: boolean[] = []

    stop()
    stop = startStaleWatchdog({
      setStale: (value) => {
        writes.push(value)
        robotActions.setStale(value)
      },
    })

    // A second of healthy streaming is fifty samples. Clearing `stale` on
    // each one would be fifty pointless writes a second.
    for (let i = 0; i < 50; i++) {
      sendSample()
      jest.advanceTimersByTime(20)
    }
    expect(writes).toEqual([false])

    jest.advanceTimersByTime(STALE_AFTER_MS)
    expect(writes).toEqual([false, true])
  })

  it('does not treat a repeated timestamp as fresh data', () => {
    sendSample()
    const repeated = useRobotStore.getState().lastUpdatedAt ?? 0

    jest.advanceTimersByTime(900)
    // A backend repeating itself is not evidence of anything being live.
    robotActions.applySample({ x: 9, y: 9, z: 9, timestamp: repeated })

    jest.advanceTimersByTime(100)
    expect(stale()).toBe(true)
  })

  it('does not treat a reset as fresh data', () => {
    sendSample()
    expect(stale()).toBe(false)

    // reset() sends lastUpdatedAt back to null - the opposite of data
    // arriving. If the watchdog mistook it for a sample it would clear
    // `stale` and arm a timer, leaving an empty panel looking live.
    robotActions.reset()
    expect(stale()).toBe(true)

    jest.advanceTimersByTime(STALE_AFTER_MS * 2)
    expect(stale()).toBe(true)
  })

  it('stops for good once stopped, leaving no timer behind', () => {
    sendSample()
    stop()

    // The pending timer must not fire into a screen that is gone.
    jest.advanceTimersByTime(STALE_AFTER_MS * 5)
    expect(stale()).toBe(false)

    // And it has stopped listening.
    sendSample()
    jest.advanceTimersByTime(STALE_AFTER_MS * 5)
    expect(stale()).toBe(false)

    expect(jest.getTimerCount()).toBe(0)
  })

  it('honours a custom timeout', () => {
    stop()
    stop = startStaleWatchdog({ staleAfterMs: 250 })

    sendSample()
    jest.advanceTimersByTime(249)
    expect(stale()).toBe(false)

    jest.advanceTimersByTime(1)
    expect(stale()).toBe(true)
  })
})
