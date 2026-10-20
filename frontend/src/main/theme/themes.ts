import { createDarkTheme, createLightTheme, type Theme } from '@fluentui/react-components'

import { pendantBrand } from './brand'

/**
 * Fluent expands the brand ramp into a full design-token set. We consume
 * tokens (tokens.colorNeutralBackground1, ...) in components rather than raw
 * hex, which is what makes a light/dark swap a one-line change here.
 */
export const pendantLightTheme: Theme = createLightTheme(pendantBrand)
export const pendantDarkTheme: Theme = createDarkTheme(pendantBrand)

/**
 * Light is the default: these panels are used in bright workshops where a
 * dark UI washes out. Dark is built now so switching later costs nothing,
 * but nothing toggles it yet.
 */
export const defaultTheme = pendantLightTheme
