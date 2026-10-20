import { Button, Spinner, Text, Title3, makeStyles, tokens } from '@fluentui/react-components'

import { TOUCH_TARGET_MIN } from '../../core/design/touchTarget'

import { jogCommandKey, type JogAxis, type JogDirection } from './jogCommand'
import { useJogController } from './useJogController'

const useStyles = makeStyles({
  root: { display: 'grid', rowGap: tokens.spacingVerticalM },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    columnGap: tokens.spacingHorizontalM,
    rowGap: tokens.spacingVerticalM,
  },
  button: {
    // Comfortably past the 48px minimum: this is operated with gloves, and a
    // mis-tap on a robot control is worse than a slightly cramped layout.
    minHeight: `${TOUCH_TARGET_MIN + 24}px`,
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
  },
  hint: { color: tokens.colorNeutralForeground3 },
  error: { color: tokens.colorPaletteRedForeground1 },
  column: { display: 'grid', rowGap: tokens.spacingVerticalXXS },
  axisLabel: { textAlign: 'center', color: tokens.colorNeutralForeground3 },
})

const AXES: readonly JogAxis[] = ['x', 'y', 'z']
const DIRECTIONS: readonly JogDirection[] = [1, -1]

/**
 * Why the operator cannot jog right now, in words rather than a greyed-out
 * control with no explanation. A disabled button that says nothing is the
 * single most common way a UI confuses someone with low digital confidence.
 */
function blockedReason(isLive: boolean, busy: boolean): string | null {
  if (!isLive) return 'Jogging is unavailable until live data resumes.'
  if (busy) return 'Waiting for the robot to acknowledge the last move…'
  return null
}

export function JogButtons() {
  const styles = useStyles()
  const { canJog, isLive, pending, lastError, jog, isPending } = useJogController()

  const reason = blockedReason(isLive, pending !== null)

  return (
    <section className={styles.root}>
      <Title3 as="h2">Jog</Title3>

      <div className={styles.grid}>
        {AXES.map((axis) => (
          <div key={axis} className={styles.column}>
            <Text className={styles.axisLabel} weight="semibold">
              {axis.toUpperCase()}
            </Text>
            {DIRECTIONS.map((direction) => (
              <Button
                key={jogCommandKey(axis, direction)}
                className={styles.button}
                appearance="primary"
                // The single source of truth from the controller. The button
                // decides nothing about safety itself.
                disabled={!canJog}
                onClick={() => jog(axis, direction)}
                icon={isPending(axis, direction) ? <Spinner size="tiny" /> : null}
              >
                {direction > 0 ? `${axis.toUpperCase()} +` : `${axis.toUpperCase()} −`}
              </Button>
            ))}
          </div>
        ))}
      </div>

      {reason !== null && <Text className={styles.hint}>{reason}</Text>}
      {lastError !== null && (
        <Text className={styles.error} role="alert">
          {lastError}
        </Text>
      )}
    </section>
  )
}
