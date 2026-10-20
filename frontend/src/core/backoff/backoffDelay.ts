/**
 * How long to wait before reconnect attempt number `attempt`.
 *
 * Pure: same inputs, same output, no clock, no globals, no state. That is
 * what makes the retry policy the easiest part of the reconnect logic to
 * test - everything hard about reconnecting is in the loop, not here.
 */
export interface BackoffOptions {
  /** Wait before the first retry. */
  baseDelayMs: number
  /** Ceiling. Without it, attempt 20 would ask for a six-day wait. */
  maxDelayMs: number
  /** Multiplier per attempt. 2 means doubling. */
  factor: number
  /**
   * How much of the delay is randomised, 0 to 1.
   *
   * 0.5 means the result lands somewhere in the top half of the delay: for a
   * 4000 ms step, between 2000 and 4000. Known as "equal jitter".
   */
  jitter: number
  random: () => number
}

export const DEFAULT_BACKOFF: BackoffOptions = {
  baseDelayMs: 500,
  maxDelayMs: 10_000,
  factor: 2,
  jitter: 0.5,
  // Wrapped rather than `random: Math.random`, so a test can spy on
  // Math.random and so the reference is resolved at call time.
  random: () => Math.random(),
}

export const MAX_RECONNECT_ATTEMPTS = 6

export function backoffDelay(
  attempt: number,
  options: Partial<BackoffOptions> = {},
): number {
  const {
    baseDelayMs = DEFAULT_BACKOFF.baseDelayMs,
    maxDelayMs = DEFAULT_BACKOFF.maxDelayMs,
    factor = DEFAULT_BACKOFF.factor,
    jitter = DEFAULT_BACKOFF.jitter,
    random = DEFAULT_BACKOFF.random,
  } = options

  // Attempt 1 is the first retry. Clamping means a caller passing 0 - the
  // usual off-by-one - gets the base delay rather than half of it.
  const safeAttempt = Math.max(1, Math.floor(attempt))

  // 500, 1000, 2000, 4000, 8000, ...
  const exponential = baseDelayMs * factor ** (safeAttempt - 1)

  // Cap BEFORE jitter, deliberately. Jittering first and capping after would
  // pile results up exactly on the ceiling; capping first means the jitter
  // spreads them *inside* the cap, so the returned value can never exceed
  // maxDelayMs. A high attempt number overflows `exponential` to Infinity,
  // and Math.min quietly turns that into the cap.
  const capped = Math.min(exponential, maxDelayMs)

  // The part that is always waited, plus the randomised part.
  const guaranteed = capped * (1 - jitter)
  const randomised = capped * jitter * random()

  // Whole milliseconds: setTimeout cannot honour fractions anyway.
  return Math.round(guaranteed + randomised)
}
