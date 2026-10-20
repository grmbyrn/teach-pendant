/**
 * Shared vocabulary for robot state. Lives in `core` because both features
 * and the stream client speak it; it is types only, so it adds no runtime code.
 */

/** A tool-centre point in millimetres. */
export interface Position {
  x: number
  y: number
  z: number
}

/** A position as it arrived from the backend, with the time it was produced. */
export interface PositionSample extends Position {
  /** Epoch milliseconds, taken from the message - not from the client clock. */
  timestamp: number
}

/**
 * Link health as the UI needs to present it. Kept to three states because
 * that is what an operator can act on: it is live, it is coming back, or
 * it is gone.
 */
export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected'
