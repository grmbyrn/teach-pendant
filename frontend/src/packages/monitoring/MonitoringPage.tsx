import { makeStyles, tokens } from '@fluentui/react-components'

import { PositionPanel } from './PositionPanel'

const useStyles = makeStyles({
  root: { display: 'grid', rowGap: tokens.spacingVerticalM },
})

export function MonitoringPage() {
  const styles = useStyles()

  return (
    <div className={styles.root}>
      <PositionPanel />
    </div>
  )
}
