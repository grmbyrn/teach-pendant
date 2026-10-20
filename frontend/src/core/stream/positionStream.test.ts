import { StreamDroppedError } from './errors'
import { positionAt, positionStream } from './positionStream'

/**
 * These tests never wait in real time. Fake timers let us jump the clock, and
 * because `now` defaults to Date.now - which Jest also fakes - the
 * timestamps the stream produces advance in step with the fake clock.
 *
 * `random` is injected so faults are chosen, not rolled: `() => 1` never
 * faults, `() => 0` always faults.
 */
describe('positionStream', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const NEVER_FAULTS = () => 1

  it('emits a sample once per interval', async () => {
    const stream = positionStream({ intervalMs: 20, random: NEVER_FAULTS })

    const pending = stream.next()
    // Nothing should have been produced before the interval elapses.
    await jest.advanceTimersByTimeAsync(19)
    await jest.advanceTimersByTimeAsync(1)

    const first = await pending
    expect(first.done).toBe(false)
    expect(first.value).toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
      z: expect.any(Number),
      timestamp: expect.any(Number),
    })

    const secondPending = stream.next()
    await jest.advanceTimersByTimeAsync(20)
    const second = await secondPending

    // 20 ms apart is 50 Hz, the rate the real stream runs at.
    const firstTs = first.value?.timestamp ?? 0
    const secondTs = second.value?.timestamp ?? 0
    expect(secondTs - firstTs).toBe(20)

    await stream.return(undefined)
  })

  it('throws StreamDroppedError when the drop roll comes up', async () => {
    const stream = positionStream({
      intervalMs: 20,
      dropProbability: 1,
      random: () => 0,
    })

    // Attach the expectation *before* advancing the clock. Advancing is what
    // makes the generator throw, and a rejected promise with no handler yet
    // attached is reported as an unhandled rejection.
    const assertion = expect(stream.next()).rejects.toThrow(StreamDroppedError)
    await jest.advanceTimersByTimeAsync(20)

    // A throw, not a quiet end: step 3 keys its reconnect off exactly this.
    await assertion
  })

  it('goes silent for the pause duration without throwing', async () => {
    const stream = positionStream({
      intervalMs: 20,
      dropProbability: 0,
      pauseProbability: 1,
      pauseDurationMs: 3000,
      random: () => 0,
    })

    const pending = stream.next()
    let settled = false
    void pending.then(() => {
      settled = true
    })

    // Past the normal interval, we would expect a sample by now.
    await jest.advanceTimersByTimeAsync(100)
    expect(settled).toBe(false)

    // This is the dangerous failure: the stream is still open and healthy,
    // it has simply stopped talking. Only a watchdog can catch it.
    await jest.advanceTimersByTimeAsync(3000)
    const result = await pending
    expect(result.done).toBe(false)

    await stream.return(undefined)
  })

  it('ends cleanly when aborted, rather than throwing', async () => {
    const controller = new AbortController()
    const stream = positionStream({
      intervalMs: 20,
      random: NEVER_FAULTS,
      signal: controller.signal,
    })

    const pending = stream.next()
    await jest.advanceTimersByTimeAsync(20)
    await pending

    controller.abort()
    const afterAbort = await stream.next()

    // done, not rejected: cancelling is a normal ending, so step 3 can tell
    // "we stopped on purpose" from "the link broke".
    expect(afterAbort.done).toBe(true)
  })

  it('stops waiting the moment it is aborted mid-interval', async () => {
    const controller = new AbortController()
    const stream = positionStream({
      intervalMs: 10_000,
      random: NEVER_FAULTS,
      signal: controller.signal,
    })

    const pending = stream.next()
    controller.abort()

    // Without an abort-aware sleep this would sit for the full 10 s, and
    // unmounting a screen would leave work running behind it.
    await jest.advanceTimersByTimeAsync(0)
    expect((await pending).done).toBe(true)
  })

  it('describes a smooth path, so the display throttle is observable', () => {
    // Pure function, no timers involved.
    expect(positionAt(0)).toEqual({ x: 400, y: 0, z: 300 })

    const a = positionAt(1000)
    const b = positionAt(1020)
    // One 20 ms step moves the tool by well under a millimetre.
    expect(Math.abs(b.x - a.x)).toBeLessThan(1)
  })
})
