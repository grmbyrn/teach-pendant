import { makeStyles, tokens } from '@fluentui/react-components'

import { JogButtons } from './JogButtons'

const useStyles = makeStyles({
  root: { display: 'grid', rowGap: tokens.spacingVerticalL },
})

/**
 * Note what is *not* here: the position readout.
 *
 * An operator jogging does want to see the coordinates, but `PositionPanel`
 * belongs to the monitoring feature, and features must not import each other
 * - that is the rule the ESLint boundary config enforces. If both are needed
 * on one screen the readout gets lifted into `main` as shell chrome, shared
 * by both features; it does not get reached across for.
 */
export function JoggingPage() {
  const styles = useStyles()

  return (
    <div className={styles.root}>
      <JogButtons />
    </div>
  )
}
