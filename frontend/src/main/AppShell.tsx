import { makeStyles, shorthands, tokens } from '@fluentui/react-components'
import { NavLink, Outlet } from 'react-router-dom'

import { usePositionStream } from '../core/stream/usePositionStream'
import { useStaleWatchdog } from '../core/watchdog/useStaleWatchdog'

import { StatusBar } from './StatusBar'
import {
  NAV_BAR_HEIGHT,
  PENDANT_HEIGHT,
  PENDANT_WIDTH,
  STATUS_BAR_HEIGHT,
  TOUCH_TARGET_MIN,
} from './pendant'

/**
 * makeStyles is Griffel: it turns these objects into atomic CSS classes at
 * build time. Nothing is computed per render and no style strings are
 * concatenated at 50 Hz, which is why it is safe on a low-powered device.
 */
const useStyles = makeStyles({
  frame: {
    // Hard-coded, not responsive: one device, one resolution.
    width: `${PENDANT_WIDTH}px`,
    height: `${PENDANT_HEIGHT}px`,
    display: 'grid',
    // Status strip, then content, then navigation. The content row is `1fr`
    // so it absorbs whatever is left - panels never push the nav off-screen.
    gridTemplateRows: `${STATUS_BAR_HEIGHT}px 1fr ${NAV_BAR_HEIGHT}px`,
    overflow: 'hidden',
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground1,
    fontFamily: tokens.fontFamilyBase,
  },

  statusBar: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.padding(0, tokens.spacingHorizontalL),
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderBottom('1px', 'solid', tokens.colorNeutralStroke2),
  },

  content: {
    // Scrolls inside itself if a panel ever overflows, so the shell stays put.
    overflowY: 'auto',
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL),
  },

  navBar: {
    display: 'grid',
    gridAutoFlow: 'column',
    gridAutoColumns: '1fr',
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderTop('1px', 'solid', tokens.colorNeutralStroke2),
  },

  navLink: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: `${TOUCH_TARGET_MIN}px`,
    textDecorationLine: 'none',
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
  },

  navLinkActive: {
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground2,
    // Thick bar rather than a subtle tint: readable at a glance, at arm's
    // length, on a panel that may be dusty.
    ...shorthands.borderTop('4px', 'solid', tokens.colorBrandStroke1),
  },
})

const NAV_ITEMS = [
  { to: '/monitoring', label: 'Monitoring' },
  { to: '/jogging', label: 'Jogging' },
] as const

/**
 * The fixed device frame: status strip, the active feature, and navigation.
 * It owns layout only - no robot state lives here.
 */
export function AppShell() {
  const styles = useStyles()

  // Both live for exactly as long as the shell does, and both clean up after
  // themselves. The stream feeds the store; the watchdog decides whether what
  // is in the store can still be trusted. Neither knows about the other.
  usePositionStream()
  useStaleWatchdog()

  return (
    <div className={styles.frame}>
      <header className={styles.statusBar}>
        <StatusBar />
      </header>

      <main className={styles.content}>
        {/* The matched route renders here. */}
        <Outlet />
      </main>

      <nav className={styles.navBar}>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
