/**
 * Minimum touch target in px, from the gloved-hands requirement.
 *
 * It lives in `core` rather than in `main` because it is a constraint every
 * feature has to honour, and a feature may not import from `main`. The shell
 * re-exports it alongside its own layout constants.
 */
export const TOUCH_TARGET_MIN = 48
