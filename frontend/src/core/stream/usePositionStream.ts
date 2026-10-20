import { useEffect } from 'react'

import { robotActions } from '../store/robotStore'

import { runPositionStream } from './runPositionStream'
import type { RunPositionStreamOptions } from './runPositionStream'

export type UsePositionStreamOptions = Omit<RunPositionStreamOptions, 'signal'>

/**
 * Run the reconnecting position stream for as long as this component is mounted.
 *
 * All the hook does is tie the loop's lifetime to the component's. The retry
 * policy is in backoffDelay, the state machine is in runPositionStream, and
 * neither needs React to be tested.
 */
export function usePositionStream(options: UsePositionStreamOptions = {}): void {
  useEffect(() => {
    // One controller per effect run. React 18 StrictMode mounts, unmounts and
    // remounts in development precisely to catch effects that do not clean up:
    // a controller created here is aborted by this run's cleanup, so the first
    // stream is dead before the second starts. A controller shared across runs
    // would leave two streams writing to one store.
    const controller = new AbortController()

    // Deliberately not awaited - an effect callback must return a cleanup
    // function, not a promise. `void` says the floating promise is intended.
    void runPositionStream({ ...options, signal: controller.signal })

    return () => {
      controller.abort()
      // Back to the fail-safe state. Without this, remounting would briefly
      // show the last position from the previous subscription as though it
      // were live - the exact "acting on stale data" case we must prevent.
      robotActions.reset()
    }
    // Empty deps on purpose: this must subscribe once per mount. Passing
    // `options` here would tear the stream down and rebuild it on every
    // render, reconnecting forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
