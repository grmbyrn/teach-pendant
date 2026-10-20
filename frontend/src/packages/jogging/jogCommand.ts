import { sleep } from '../../core/stream/sleep'

export type JogAxis = 'x' | 'y' | 'z'

/** +1 jogs in the positive direction along the axis, -1 the negative. */
export type JogDirection = 1 | -1

export interface JogCommand {
  axis: JogAxis
  direction: JogDirection
}

/** Stand-in for the round trip to the .NET backend. */
export const JOG_COMMAND_LATENCY_MS = 300

/**
 * Send one jog command and resolve when the robot has acknowledged it.
 *
 * In the real app this is a unary gRPC-Web call. What matters for the UI is
 * only the shape: it is asynchronous, it can fail, and it takes long enough
 * that an operator will tap again before it finishes.
 */
export async function sendJogCommand(
  _command: JogCommand,
  signal?: AbortSignal | undefined,
): Promise<void> {
  await sleep(JOG_COMMAND_LATENCY_MS, signal)
}

/** Stable key for one button, used to match a pending command to its button. */
export function jogCommandKey(axis: JogAxis, direction: JogDirection): string {
  return `${axis}${direction > 0 ? '+' : '-'}`
}
