import { useEffect } from 'react'

import { startStaleWatchdog, type StaleWatchdogOptions } from './staleWatchdog'

/**
 * Run the stale watchdog for as long as this component is mounted.
 *
 * `startStaleWatchdog` already returns its own stop function, which is
 * exactly the shape useEffect wants back - so the hook is one line and the
 * timer cannot outlive the screen.
 */
export function useStaleWatchdog(options: StaleWatchdogOptions = {}): void {
  // Subscribe once per mount. Putting `options` in the deps would tear the
  // watchdog down and rebuild it on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => startStaleWatchdog(options), [])
}
