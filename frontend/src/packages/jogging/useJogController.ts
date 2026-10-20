import { useCallback, useEffect, useRef, useState } from 'react'

import { selectIsLive, useIsLive, useRobotStore } from '../../core/store/robotStore'

import {
  jogCommandKey,
  sendJogCommand,
  type JogAxis,
  type JogCommand,
  type JogDirection,
} from './jogCommand'

export interface UseJogControllerOptions {
  send?: ((command: JogCommand, signal?: AbortSignal) => Promise<void>) | undefined
}

export interface JogController {
  /** What the buttons bind their `disabled` to. */
  canJog: boolean
  /** The link is up and the data is fresh, ignoring whether we are busy. */
  isLive: boolean
  /** The command currently in flight, or null. */
  pending: JogCommand | null
  lastError: string | null
  jog: (axis: JogAxis, direction: JogDirection) => void
  isPending: (axis: JogAxis, direction: JogDirection) => boolean
}

/**
 * Decides whether an operator is allowed to jog, and tracks the one command
 * that may be in flight.
 *
 * All of the safety-relevant behaviour is here rather than in the button, so
 * it can be tested without rendering anything and cannot be bypassed by a
 * component that forgets to check a flag.
 */
export function useJogController({
  send = sendJogCommand,
}: UseJogControllerOptions = {}): JogController {
  const isLive = useIsLive()
  const [pending, setPending] = useState<JogCommand | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)

  /**
   * The real guard against repeat taps - a ref, not the `pending` state.
   *
   * setState is asynchronous: two taps in the same tick would both read
   * `pending` as null and both send a command. A ref updates immediately, so
   * the second tap sees the lock the first one took. This is the difference
   * between "the button looks busy" and "the robot cannot be double-jogged".
   */
  const inFlight = useRef(false)

  /** Avoids setting state after the screen has gone. */
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const jog = useCallback(
    (axis: JogAxis, direction: JogDirection) => {
      // Re-read liveness from the store instead of trusting the value this
      // render closed over. The render decides what the button *looks* like;
      // the tap re-checks what is actually true at the moment it happens.
      // With the display throttled to 10-20 Hz those can differ by tens of
      // milliseconds, and this is the side of that gap that must be safe.
      if (!selectIsLive(useRobotStore.getState())) return

      if (inFlight.current) return

      const command: JogCommand = { axis, direction }
      inFlight.current = true
      setPending(command)
      setLastError(null)

      void (async () => {
        try {
          await send(command)
        } catch (error) {
          if (mounted.current) {
            setLastError(error instanceof Error ? error.message : String(error))
          }
        } finally {
          // Released in `finally`, so a failed command cannot leave the
          // button stuck pending forever - which would look like a hung UI
          // and tempt an operator to start tapping.
          inFlight.current = false
          if (mounted.current) setPending(null)
        }
      })()
    },
    [send],
  )

  const isPending = useCallback(
    (axis: JogAxis, direction: JogDirection) =>
      pending !== null && jogCommandKey(pending.axis, pending.direction) === jogCommandKey(axis, direction),
    [pending],
  )

  return {
    // One command at a time: a robot should not be given a second motion
    // instruction while the first is unacknowledged, even on a different axis.
    canJog: isLive && pending === null,
    isLive,
    pending,
    lastError,
    jog,
    isPending,
  }
}
