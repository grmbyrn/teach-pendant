import type { Position, PositionSample } from '../types/robot'

import { StreamDroppedError } from './errors'
import { sleep } from './sleep'

/**
 * Everything about the mock's behaviour, in one injectable object.
 *
 * `random` and `now` are parameters rather than direct calls to Math.random
 * and Date.now so tests can make the faults happen on demand. A stream that
 * only misbehaves randomly is a stream you cannot write a test for.
 */
export interface PositionStreamConfig {
  /** Gap between samples. 20 ms is 50 Hz, the real stream's rate. */
  intervalMs: number
  /** Chance per sample that the link drops and the generator throws. */
  dropProbability: number
  /** Chance per sample that the backend goes quiet without dropping. */
  pauseProbability: number
  /** How long such a silence lasts. */
  pauseDurationMs: number
  random: () => number
  now: () => number
}

export type PositionStreamOptions = Partial<PositionStreamConfig> & {
  signal?: AbortSignal | undefined
}

/**
 * Probabilities are per sample, so at 50 Hz they read as "about once every N
 * seconds": a drop roughly every 40 s, a silence roughly every 20 s. Often
 * enough to demonstrate reconnect and the watchdog without making the
 * prototype unusable.
 */
export const DEFAULT_STREAM_CONFIG: PositionStreamConfig = {
  intervalMs: 20,
  dropProbability: 0.0005,
  pauseProbability: 0.001,
  pauseDurationMs: 3000,

  // Wrapped, not `random: Math.random` / `now: Date.now`. Storing the bare
  // reference captures whatever those are at module-load time, which is
  // before Jest's fake timers swap out Date.now - so the stream would keep
  // stamping real wall-clock time and no test could control it. The same
  // trap defeats jest.spyOn. Calling through resolves them at call time.
  random: () => Math.random(),
  now: () => Date.now(),
}

/**
 * Where the tool is at a given moment, as a smooth path rather than noise.
 *
 * Pure and exported so it can be asserted on directly. Smooth motion is also
 * a practical choice: against random jitter you cannot see whether the
 * display throttle in step 5 is working, but against a slow sine you can.
 *
 * Three different frequencies keep the axes from moving in lockstep.
 */
export function positionAt(elapsedMs: number): Position {
  const t = elapsedMs / 1000

  return {
    x: 400 + 50 * Math.sin(t * 0.6),
    y: 50 * Math.sin(t * 0.37),
    z: 300 + 25 * Math.sin(t * 0.23),
  }
}

/**
 * The mock live stream: positions at ~50 Hz, with injected faults.
 *
 * An async generator rather than a callback or an EventEmitter, because the
 * consumer then reads it with `for await (const sample of ...)`. That gives
 * us ordinary control flow - a `throw` the caller can catch, a `break` that
 * cleans up - instead of unsubscribe bookkeeping. The `finally` below runs on
 * all three endings: abort, throw, and the consumer breaking out of its loop.
 *
 * Two distinct failures are simulated, because the UI must react differently:
 *   - a drop: the stream throws, connectionStatus goes to 'reconnecting'
 *   - a silence: the stream stays open but sends nothing, so only the
 *     watchdog notices and the data is merely stale
 * The second is the dangerous one - nothing errors, so without a watchdog the
 * UI would happily keep showing a frozen position as if it were live.
 */
export async function* positionStream(
  options: PositionStreamOptions = {},
): AsyncGenerator<PositionSample, void, void> {
  // Destructured defaults, not an object spread: a spread would let an
  // explicit `{ intervalMs: undefined }` overwrite the default with undefined.
  const {
    intervalMs = DEFAULT_STREAM_CONFIG.intervalMs,
    dropProbability = DEFAULT_STREAM_CONFIG.dropProbability,
    pauseProbability = DEFAULT_STREAM_CONFIG.pauseProbability,
    pauseDurationMs = DEFAULT_STREAM_CONFIG.pauseDurationMs,
    random = DEFAULT_STREAM_CONFIG.random,
    now = DEFAULT_STREAM_CONFIG.now,
    signal,
  } = options

  const startedAt = now()

  try {
    while (!signal?.aborted) {
      await sleep(intervalMs, signal)
      // Re-check after every wait: the abort may have arrived mid-sleep.
      if (signal?.aborted) return

      // One roll decides both faults, so the two chances cannot overlap.
      const roll = random()

      if (roll < dropProbability) {
        throw new StreamDroppedError()
      }

      if (roll < dropProbability + pauseProbability) {
        await sleep(pauseDurationMs, signal)
        if (signal?.aborted) return
      }

      const timestamp = now()
      yield { ...positionAt(timestamp - startedAt), timestamp }
    }
  } finally {
    // Nothing to release in the mock. The real client closes its gRPC-Web
    // call here, and this is the hook that guarantees it happens on every
    // exit path.
  }
}
