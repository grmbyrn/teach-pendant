/**
 * Physical facts about the target device, in one place.
 *
 * The real pendant is a single handheld panel at one fixed resolution, so
 * these are constants rather than breakpoints: there is no second layout to
 * design for, and pretending otherwise would add complexity for nothing.
 */
export const PENDANT_WIDTH = 800
export const PENDANT_HEIGHT = 480

/** Status strip across the top. */
export const STATUS_BAR_HEIGHT = 56

/** Bottom navigation; sized so a gloved thumb cannot miss it. */
export const NAV_BAR_HEIGHT = 72

/**
 * Re-exported so the shell has every device constant in one import. The
 * value itself lives in core, because features need it too and features
 * may not import from main.
 */
export { TOUCH_TARGET_MIN } from '../core/design/touchTarget'
