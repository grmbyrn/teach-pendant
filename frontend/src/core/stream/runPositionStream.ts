import { MAX_RECONNECT_ATTEMPTS, backoffDelay } from '../backoff/backoffDelay'
import { robotActions } from '../store/robotStore'
import type { RobotActions } from '../store/robotStore'
import type { PositionSample } from '../types/robot'

import { StreamDroppedError } from './errors'
import { positionStream } from './positionStream'
import { sleep } from './sleep'

/** Only the actions this loop is allowed to call. */
export type ReconnectActions = Pick<
  RobotActions,
  'applySample' | 'setConnectionStatus' | 'setRetryAttempt'
>

export type PositionStreamFactory = (options: {
  signal: AbortSignal
}) => AsyncGenerator<PositionSample, void, void>

export interface RunPositionStreamOptions {
  /** Aborting this stops the loop for good: no further reconnects. */
  signal: AbortSignal
  stream?: PositionStreamFactory | undefined
  delayFor?: ((attempt: number) => number) | undefined
  maxAttempts?: number | undefined
  actions?: ReconnectActions | undefined
  /** Called for errors that are not a dropped connection. */
  onError?: ((error: unknown) => void) | undefined
}

/**
 * Consume the position stream forever, reconnecting with backoff when it drops.
 *
 * Written as a plain async function rather than a hook so it can be tested
 * without React: the hook below is a four-line wrapper that owns the
 * AbortController and nothing else.
 */
export async function runPositionStream({
  signal,
  stream = positionStream,
  delayFor = backoffDelay,
  maxAttempts = MAX_RECONNECT_ATTEMPTS,
  actions = robotActions,
  onError = (error) => console.error('[positionStream]', error),
}: RunPositionStreamOptions): Promise<void> {
  // 0 = connecting for the first time; 1+ = reconnect attempt N after a drop.
  let attempt = 0

  while (!signal.aborted) {
    // We are not connected until data proves it. See the note below.
    actions.setConnectionStatus('reconnecting')
    actions.setRetryAttempt(attempt)

    try {
      // `sawSample` keeps the "we are live" write out of the 50 Hz path: it
      // runs once per connection, not once per message.
      let sawSample = false

      for await (const sample of stream({ signal })) {
        if (!sawSample) {
          sawSample = true
          // Connected is declared by the arrival of real data, never by the
          // act of subscribing - subscribing only proves we asked.
          actions.setConnectionStatus('connected')
          // Ladder resets, so the next unrelated drop starts at 500 ms again
          // rather than wherever the last outage left off.
          attempt = 0
          actions.setRetryAttempt(0)
        }

        actions.applySample(sample)
      }

      // The loop ended without throwing, which only happens when the stream
      // was cancelled. That was us, on purpose, so do not reconnect.
      return
    } catch (error) {
      // Cancelling mid-flight can surface as an error; it is still a
      // deliberate stop, so check this before anything else.
      if (signal.aborted) return

      if (!(error instanceof StreamDroppedError)) {
        // An unexpected failure is not a connection problem, so retrying is
        // the wrong response. Report it and go to the safe state - but do
        // not pretend it did not happen.
        actions.setConnectionStatus('disconnected')
        actions.setRetryAttempt(attempt)
        onError(error)
        return
      }

      attempt += 1

      if (attempt > maxAttempts) {
        // Give up rather than retry forever. A pendant quietly retrying for
        // an hour tells the operator nothing; "disconnected" tells them to
        // go and find out why.
        actions.setConnectionStatus('disconnected')
        actions.setRetryAttempt(attempt - 1)
        return
      }

      actions.setConnectionStatus('reconnecting')
      actions.setRetryAttempt(attempt)

      // Abort-aware, so unmounting during a 10 s wait stops immediately
      // instead of reconnecting into a screen that no longer exists.
      await sleep(delayFor(attempt), signal)
    }
  }
}

/*
 * Why 'connected' is set by the first sample, not by subscribing
 * -------------------------------------------------------------
 * Subscribing is a local act: it proves we asked, not that anyone answered.
 * If we flipped to 'connected' there, then for the gap between asking and
 * the first message - which is exactly how long a dead backend takes to
 * notice - the UI would say connected, un-grey the jog buttons and offer an
 * operator controls backed by no data at all.
 *
 * Only the arrival of a message proves the whole path works. Three states
 * also means "connecting" and "reconnecting" share one value; that is fine,
 * because `retryAttempt` separates them (0 = first connect) and the operator
 * only needs to know "not live yet".
 */
