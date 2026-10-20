import { useEffect, useRef, useState } from 'react'

import type { Position } from '../types/robot'

import { useRobotStore } from './robotStore'

/**
 * How often the readout is allowed to repaint. The stream runs at 50 Hz; a
 * human cannot read digits changing that fast, and on this device those 35
 * extra repaints a second are pure cost.
 */
export const DISPLAY_HZ = 15

/**
 * The position, repainted at ~15 Hz instead of 50 Hz.
 *
 * The trick is that the store subscription writes to a plain variable rather
 * than to React state - so 50 messages a second cost one assignment each and
 * cause no render at all. A timer then publishes the newest value into state
 * at the display rate. Fast data, slow paint.
 */
export function useThrottledPosition(hz: number = DISPLAY_HZ): Position | null {
  const [shown, setShown] = useState<Position | null>(() => useRobotStore.getState().position)
  const shownRef = useRef<Position | null>(shown)

  useEffect(() => {
    let latest = useRobotStore.getState().position

    // No selector and no hook: this must not re-render anything.
    const unsubscribe = useRobotStore.subscribe((state) => {
      latest = state.position
    })

    const timer = setInterval(() => {
      // Skip when nothing changed, so a silent stream costs no renders.
      if (latest === shownRef.current) return
      shownRef.current = latest
      setShown(latest)
    }, 1000 / hz)

    return () => {
      clearInterval(timer)
      unsubscribe()
    }
  }, [hz])

  return shown
}
