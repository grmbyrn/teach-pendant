import { create } from 'zustand'

import type { ConnectionStatus, Position, PositionSample } from '../types/robot'

export interface RobotState {
  /** Latest known position, or null before the first sample arrives. */
  position: Position | null
  /** Timestamp of that sample. Null means "we have never had data". */
  lastUpdatedAt: number | null
  /** True when the data on screen can no longer be trusted as live. */
  stale: boolean
  connectionStatus: ConnectionStatus
  /** Which reconnect attempt we are on; 0 when not reconnecting. */
  retryAttempt: number
}

export interface RobotActions {
  /**
   * Record one sample from the stream. Called at 50 Hz, so it stays trivial:
   * no derivation, no timers, no comparisons.
   *
   * Note what it does *not* touch: `stale`. See the ownership note below.
   */
  applySample: (sample: PositionSample) => void

  /** Owned by the watchdog (step 4). */
  setStale: (stale: boolean) => void

  /** Owned by the reconnect logic (step 3). */
  setConnectionStatus: (status: ConnectionStatus) => void
  setRetryAttempt: (retryAttempt: number) => void

  /** Back to the fail-safe starting point - used on unmount and in tests. */
  reset: () => void
}

export type RobotStore = RobotState & RobotActions

/**
 * The initial state is deliberately the *unsafe-to-act* state: disconnected
 * and stale, with no position.
 *
 * This is the fail-safe default the brief asks for. If we started as
 * 'connected' and fresh, then for the first moments after boot - and after
 * any state we forgot to handle - the jog buttons would be live while we had
 * no idea where the robot actually is. Starting locked means the UI has to
 * *earn* the right to be interactive by receiving real data, rather than
 * assuming it until something proves otherwise.
 */
export const initialRobotState: RobotState = {
  position: null,
  lastUpdatedAt: null,
  stale: true,
  connectionStatus: 'disconnected',
  retryAttempt: 0,
}

export const useRobotStore = create<RobotStore>()((set) => ({
  ...initialRobotState,

  applySample: (sample) =>
    set({
      position: { x: sample.x, y: sample.y, z: sample.z },
      // The message's own timestamp, not Date.now(). If we stamped arrival
      // time we would be measuring our own clock and would call data fresh
      // that the backend produced seconds ago.
      lastUpdatedAt: sample.timestamp,
    }),

  setStale: (stale) => set({ stale }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setRetryAttempt: (retryAttempt) => set({ retryAttempt }),
  reset: () => set({ ...initialRobotState }),
}))

/*
 * Who owns `stale`
 * ----------------
 * Only the watchdog writes it. `applySample` could plausibly clear it on
 * every message, but then two pieces of code would set the same flag from
 * opposite directions fifty times a second, and a bug in either would be
 * very hard to see. The watchdog already has to restart its timer on each
 * sample, so it is the one place that knows both "data arrived" and "data
 * stopped". One writer, one rule.
 */

/*
 * Selectors
 * ---------
 * Each hook subscribes to one field, so a component re-renders only when
 * that field changes. A component calling `useRobotStore()` with no selector
 * would re-render on every sample - fifty times a second, for all of it.
 *
 * Each returns a primitive or a stable reference, so Zustand's default
 * Object.is comparison is enough and no shallow-equality helper is needed.
 */
/**
 * The one rule that decides whether what is on screen can be acted on:
 * the link is up AND the data is fresh.
 *
 * It lives in core, as a plain function of state, because two features need
 * the same answer - monitoring greys out the readout, jogging disables the
 * buttons - and two copies of this predicate would eventually disagree.
 */
export const selectIsLive = (state: RobotState): boolean =>
  state.connectionStatus === 'connected' && !state.stale

export const usePosition = () => useRobotStore((s) => s.position)
export const useLastUpdatedAt = () => useRobotStore((s) => s.lastUpdatedAt)
export const useStale = () => useRobotStore((s) => s.stale)
export const useConnectionStatus = () => useRobotStore((s) => s.connectionStatus)
export const useRetryAttempt = () => useRobotStore((s) => s.retryAttempt)
/** Returns a boolean, so Zustand's Object.is comparison is enough. */
export const useIsLive = () => useRobotStore(selectIsLive)

/**
 * For non-React callers - the stream consumer, the watchdog, the reconnect
 * loop. Reaching for `getState()` instead of a hook means the writer never
 * subscribes, so pushing a sample in cannot re-render the thing that pushed it.
 */
export const robotActions = {
  applySample: (sample: PositionSample) => useRobotStore.getState().applySample(sample),
  setStale: (stale: boolean) => useRobotStore.getState().setStale(stale),
  setConnectionStatus: (status: ConnectionStatus) =>
    useRobotStore.getState().setConnectionStatus(status),
  setRetryAttempt: (attempt: number) => useRobotStore.getState().setRetryAttempt(attempt),
  reset: () => useRobotStore.getState().reset(),
}
