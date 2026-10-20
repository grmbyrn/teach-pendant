import { DEFAULT_BACKOFF, backoffDelay } from './backoffDelay'

/**
 * No timers and no mocks beyond `random`, because the function is pure.
 *
 * `random: () => 1` is the top of the jitter range and `() => 0` the bottom,
 * which turns a randomised value into two exact numbers we can assert on.
 */
describe('backoffDelay', () => {
  const noJitter = { jitter: 0 }
  const maxRandom = { random: () => 1 }
  const minRandom = { random: () => 0 }

  it('doubles each attempt, starting at the base delay', () => {
    const delays = [1, 2, 3, 4, 5].map((attempt) => backoffDelay(attempt, noJitter))

    expect(delays).toEqual([500, 1000, 2000, 4000, 8000])
  })

  it('never exceeds the cap, however many attempts have failed', () => {
    expect(backoffDelay(6, noJitter)).toBe(10_000)
    expect(backoffDelay(20, noJitter)).toBe(10_000)

    // 2 ** 1023 overflows to Infinity; the cap has to survive that too,
    // otherwise a long outage ends in a NaN or Infinity timeout.
    expect(backoffDelay(5000, noJitter)).toBe(10_000)
  })

  it('caps before jittering, so a jittered delay cannot exceed the cap', () => {
    // Top of the jitter range at a capped attempt: still exactly the cap.
    expect(backoffDelay(20, maxRandom)).toBe(10_000)
    expect(backoffDelay(20, maxRandom)).toBeLessThanOrEqual(DEFAULT_BACKOFF.maxDelayMs)
  })

  it('keeps the jittered delay within the top half of the step', () => {
    // jitter 0.5 -> result lands between half the step and the whole step.
    expect(backoffDelay(4, minRandom)).toBe(2000)
    expect(backoffDelay(4, maxRandom)).toBe(4000)
  })

  it('stays inside its bounds for every attempt and any random value', () => {
    // A property check rather than a table: whatever Math.random returns,
    // the result must sit between half the capped step and the capped step.
    for (let attempt = 1; attempt <= 25; attempt++) {
      const lower = backoffDelay(attempt, minRandom)
      const upper = backoffDelay(attempt, maxRandom)
      const actual = backoffDelay(attempt)

      expect(actual).toBeGreaterThanOrEqual(lower)
      expect(actual).toBeLessThanOrEqual(upper)
      expect(upper).toBeLessThanOrEqual(DEFAULT_BACKOFF.maxDelayMs)
    }
  })

  it('treats attempt 0 or negative as the first attempt', () => {
    // Guards the classic off-by-one: a caller passing a 0-based counter
    // should still wait the base delay, not 250 ms.
    expect(backoffDelay(0, noJitter)).toBe(500)
    expect(backoffDelay(-3, noJitter)).toBe(500)
  })

  it('actually varies when given real randomness', () => {
    const results = new Set(
      Array.from({ length: 50 }, () => backoffDelay(5)),
    )

    // If this ever returns one value, the jitter has been wired up wrong and
    // every pendant on the floor would retry in lockstep.
    expect(results.size).toBeGreaterThan(1)
  })
})
