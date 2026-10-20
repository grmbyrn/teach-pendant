import { initialRobotState, robotActions, useRobotStore } from './robotStore'

describe('robotStore', () => {
  beforeEach(() => {
    // The store is a module singleton, so state leaks between tests unless
    // we reset it. Same call the app uses on unmount.
    useRobotStore.getState().reset()
  })

  it('starts in the fail-safe state: disconnected, stale, no position', () => {
    const state = useRobotStore.getState()

    expect(state.position).toBeNull()
    expect(state.lastUpdatedAt).toBeNull()
    // Both must hold on boot, or the jog buttons would be live before we
    // know where the robot is.
    expect(state.stale).toBe(true)
    expect(state.connectionStatus).toBe('disconnected')
    expect(state.retryAttempt).toBe(0)
  })

  it('applies a sample using the message timestamp, not arrival time', () => {
    robotActions.applySample({ x: 1, y: 2, z: 3, timestamp: 1_000 })

    const state = useRobotStore.getState()
    expect(state.position).toEqual({ x: 1, y: 2, z: 3 })
    expect(state.lastUpdatedAt).toBe(1_000)
  })

  it('leaves `stale` alone when a sample arrives', () => {
    robotActions.setStale(true)
    robotActions.applySample({ x: 1, y: 2, z: 3, timestamp: 1_000 })

    // Deliberate: the watchdog is the only writer of `stale` (step 4).
    // If this ever starts failing, two owners have appeared.
    expect(useRobotStore.getState().stale).toBe(true)
  })

  it('stores a plain position, not a reference to the sample', () => {
    const sample = { x: 1, y: 2, z: 3, timestamp: 1_000 }
    robotActions.applySample(sample)
    sample.x = 999

    // Holding the sample itself would let a later mutation change what the
    // UI shows without any store update.
    expect(useRobotStore.getState().position).toEqual({ x: 1, y: 2, z: 3 })
  })

  it('tracks connection status and retry attempts', () => {
    robotActions.setConnectionStatus('reconnecting')
    robotActions.setRetryAttempt(3)

    expect(useRobotStore.getState().connectionStatus).toBe('reconnecting')
    expect(useRobotStore.getState().retryAttempt).toBe(3)
  })

  it('reset returns every field to the fail-safe state', () => {
    robotActions.applySample({ x: 1, y: 2, z: 3, timestamp: 1_000 })
    robotActions.setConnectionStatus('connected')
    robotActions.setRetryAttempt(2)
    robotActions.setStale(false)

    robotActions.reset()

    expect(useRobotStore.getState()).toMatchObject(initialRobotState)
  })

  it('notifies a field subscriber only when that field changes', () => {
    const onStatus = jest.fn()
    const unsubscribe = useRobotStore.subscribe((s, prev) => {
      if (s.connectionStatus !== prev.connectionStatus) onStatus(s.connectionStatus)
    })

    // 50 Hz of position updates must not wake up anything watching status.
    robotActions.applySample({ x: 1, y: 2, z: 3, timestamp: 1 })
    robotActions.applySample({ x: 2, y: 3, z: 4, timestamp: 2 })
    expect(onStatus).not.toHaveBeenCalled()

    robotActions.setConnectionStatus('connected')
    expect(onStatus).toHaveBeenCalledWith('connected')

    unsubscribe()
  })
})
