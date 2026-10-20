/**
 * Thrown when the stream dies unexpectedly - the mock's stand-in for a
 * gRPC-Web stream erroring out.
 *
 * This exists as its own type because the reconnect logic in step 3 has to
 * tell two endings apart:
 *
 *   - the generator *returns*  -> we cancelled on purpose, do not reconnect
 *   - the generator *throws*   -> the link broke, start backing off
 *
 * Collapsing both into one path is how apps end up retrying a stream the
 * operator deliberately closed, or silently giving up on a real drop.
 */
export class StreamDroppedError extends Error {
  constructor(message = 'Position stream dropped') {
    super(message)
    this.name = 'StreamDroppedError'
  }
}
