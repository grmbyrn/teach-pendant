import { Badge, Text, Title3, makeStyles, shorthands, tokens } from '@fluentui/react-components'

import { useConnectionStatus, useStale } from '../../core/store/robotStore'
import { useThrottledPosition } from '../../core/store/useThrottledPosition'
import type { Position } from '../../core/types/robot'

const useStyles = makeStyles({
  root: {
    display: 'grid',
    rowGap: tokens.spacingVerticalM,
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
  },
  /** Greyed out, not hidden: the operator still sees the last known figures. */
  untrusted: { opacity: 0.45 },
  header: { display: 'flex', alignItems: 'center', columnGap: tokens.spacingHorizontalM },
  axes: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', columnGap: tokens.spacingHorizontalL },
  axis: { display: 'grid', rowGap: tokens.spacingVerticalXXS },
  label: { color: tokens.colorNeutralForeground3 },
  value: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeHero700,
    // Tabular figures keep the digits the same width, so the numbers do not
    // jitter sideways fifteen times a second.
    fontVariantNumeric: 'tabular-nums',
  },
})

const AXES = ['x', 'y', 'z'] as const

function format(position: Position | null, axis: (typeof AXES)[number]): string {
  if (position === null) return '—'
  return position[axis].toFixed(2)
}

/**
 * The live position readout.
 *
 * It reads the throttled position, so the 50 Hz stream repaints this at
 * ~15 Hz and repaints nothing else in the app.
 */
export function PositionPanel() {
  const styles = useStyles()
  const position = useThrottledPosition()
  const stale = useStale()
  const status = useConnectionStatus()

  // Two different reasons not to trust the figures, one visual treatment -
  // because the operator's decision is the same either way: do not act.
  const untrusted = stale || status !== 'connected'

  return (
    <section
      className={`${styles.root} ${untrusted ? styles.untrusted : ''}`}
      aria-labelledby="position-panel-heading"
    >
      <div className={styles.header}>
        <Title3 as="h2" id="position-panel-heading">
          Tool position
        </Title3>
        {untrusted && (
          <Badge appearance="filled" color="warning">
            {status === 'connected' ? 'Not up to date' : 'No live data'}
          </Badge>
        )}
      </div>

      <div className={styles.axes}>
        {AXES.map((axis) => (
          <div key={axis} className={styles.axis}>
            <Text className={styles.label} weight="semibold">
              {axis.toUpperCase()} (mm)
            </Text>
            <Text className={styles.value} aria-label={`${axis.toUpperCase()} position`}>
              {format(position, axis)}
            </Text>
          </div>
        ))}
      </div>
    </section>
  )
}
