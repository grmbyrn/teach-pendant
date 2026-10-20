import { useRobotStore } from '../store/robotStore'

/**
 * How long silence is tolerated before the data on screen stops counting as
 * live. One second: long enough that a missed frame at 50 Hz is not a
 * warning, short enough that an operator cannot act on a stale readout.
 */
export const STALE_AFTER_MS = 1000

export interface StaleWatchdogOptions {
  staleAfterMs?: number | undefined
  /**
   * Where to write the flag. Defaults to the store.
   *
   * A seam for tests, for the same reason `random` is one in the stream:
   * counting writes is the only way to prove this does not write fifty times
   * a second. Do not reach for jest.spyOn on a Zustand action instead -
   * `set` copies actions onto each new state object, so a spy outlives the
   * test that installed it and a restored one leaves the store inert.
   */
  setStale?: ((stale: boolean) => void) | undefined
}

/**
 * Watch for the stream going quiet, and mark the data stale when it does.
 *
 * This exists because a dropped connection is not the dangerous failure. A
 * drop throws, and the reconnect loop reacts. The dangerous failure is a
 * stream that stays open and simply stops sending: nothing errors, so
 * without this the UI would keep displaying a frozen position as though the
 * robot were still reporting it.
 *
 * It observes the store rather than being called by the stream. The stream
 * does not need to know a watchdog exists, and anything else that writes
 * samples is covered automatically.
 *
 * Returns a stop function.
 */
export function startStaleWatchdog({
  staleAfterMs = STALE_AFTER_MS,
  setStale = (stale: boolean) => useRobotStore.getState().setStale(stale),
}: StaleWatchdogOptions = {}): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined

  const markStale = () => {
    timer = undefined
    setStale(true)
  }

  const onData = () => {
    // Only write on an actual transition. This runs fifty times a second, and
    // setting `stale` to false when it is already false would notify every
    // store subscriber for no change.
    if (useRobotStore.getState().stale) setStale(false)

    // Restart the clock. The timer is recreated per sample rather than
    // reused, which is the simple, obviously-correct version: one timer
    // object at a time, and the cost is negligible beside the fifty store
    // writes per second already happening. A cleverer timer that reschedules
    // itself would save little and read much worse.
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(markStale, staleAfterMs)
  }

  const unsubscribe = useRobotStore.subscribe((state, previous) => {
    // Keyed on the message timestamp, not on a counter. Two consecutive
    // samples carrying the same timestamp mean the backend is repeating
    // itself, which is not evidence of fresh data - so we let it go stale.
    if (state.lastUpdatedAt === previous.lastUpdatedAt) return

    // A reset sends lastUpdatedAt back to null. That is the opposite of data
    // arriving, and must not be mistaken for it.
    if (state.lastUpdatedAt === null) return

    onData()
  })

  return () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    unsubscribe()
  }
}

/*
 * One subtlety, because it looks like a bug when you first see it
 * ---------------------------------------------------------------
 * This writes to the store from inside a store subscription, which is a
 * reentrant update. Zustand hands each listener the *current* state, so any
 * listener that runs after ours in the same notification pass sees the state
 * we just changed, paired with the state from before the original update -
 * and therefore reports the stale transition a second time.
 *
 * It is a duplicate notification, not a duplicate write: `setStale` is
 * called once per transition, and there is a test asserting exactly that.
 * It is harmless because selector hooks compare the value they select, so an
 * extra notification carrying an unchanged value causes no extra render.
 */
