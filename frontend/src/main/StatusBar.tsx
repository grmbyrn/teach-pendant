import { Badge, Text, makeStyles, shorthands, tokens } from '@fluentui/react-components'

import { MAX_RECONNECT_ATTEMPTS } from '../core/backoff/backoffDelay'
import { useConnectionStatus, useRetryAttempt, useStale } from '../core/store/robotStore'
import type { ConnectionStatus } from '../core/types/robot'

const useStyles = makeStyles({
  root: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalM,
    width: '100%',
  },
  spacer: { marginLeft: 'auto' },
  dot: {
    width: '14px',
    height: '14px',
    ...shorthands.borderRadius('50%'),
    flexShrink: 0,
  },
  connected: { backgroundColor: tokens.colorPaletteGreenBackground3 },
  reconnecting: { backgroundColor: tokens.colorPaletteYellowBackground3 },
  disconnected: { backgroundColor: tokens.colorPaletteRedBackground3 },
})

/**
 * Plain language, not jargon: operators are told what is true and what it
 * means for them, never "WebSocket readyState 3".
 */
function connectionLabel(status: ConnectionStatus, retryAttempt: number): string {
  switch (status) {
    case 'connected':
      return 'Connected'
    case 'reconnecting':
      // retryAttempt 0 means we have never been connected yet, so calling it
      // "reconnecting" would be a lie. Same state, honest wording.
      return retryAttempt === 0
        ? 'Connecting…'
        : `Reconnecting — attempt ${retryAttempt} of ${MAX_RECONNECT_ATTEMPTS}`
    case 'disconnected':
      return 'Disconnected'
  }
}

/**
 * The permanent status strip. It reads three independent facts from the
 * store, each through its own selector, so a 50 Hz position update does not
 * repaint any of it.
 */
export function StatusBar() {
  const styles = useStyles()
  const status = useConnectionStatus()
  const retryAttempt = useRetryAttempt()
  const stale = useStale()

  return (
    <div className={styles.root} role="status" aria-live="polite">
      {/* The dot is backed up by the text label - colour is never the only
          signal, since a dusty panel and a colour-blind operator are both
          real possibilities. */}
      <span className={`${styles.dot} ${styles[status]}`} aria-hidden="true" />
      <Text weight="semibold">{connectionLabel(status, retryAttempt)}</Text>

      {stale && (
        <span className={styles.spacer}>
          {/* The one warning that matters: what is on screen is not current. */}
          <Badge appearance="filled" color="warning" size="large">
            Data not up to date
          </Badge>
        </span>
      )}
    </div>
  )
}
