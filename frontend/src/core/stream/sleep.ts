/**
 * A delay that gives up early when the caller aborts.
 *
 * It *resolves* on abort rather than rejecting: the stream treats
 * cancellation as a normal ending, so making it an exception here would
 * force a try/catch around every wait for something that is not an error.
 *
 * The abort listener is always removed. At 50 Hz this runs fifty times a
 * second, and a listener left on a long-lived AbortSignal each time is a
 * slow leak - which matters on a device with little memory to spare.
 */
export function sleep(ms: number, signal?: AbortSignal | undefined): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve()
      return
    }

    const finish = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', finish)
      resolve()
    }

    const timer = setTimeout(finish, ms)
    signal?.addEventListener('abort', finish, { once: true })
  })
}
