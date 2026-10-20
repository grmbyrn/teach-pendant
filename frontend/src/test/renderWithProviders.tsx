import type { ReactElement } from 'react'

import { FluentProvider } from '@fluentui/react-components'
import { type RenderOptions, render } from '@testing-library/react'

import { defaultTheme } from '../main/theme/themes'

/**
 * Every test renders through here. Fluent components read their tokens from
 * FluentProvider via context, so a component rendered without it throws or
 * renders unstyled - wrapping once centrally stops each test re-stating that.
 */
export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: FluentTestProvider, ...options })
}

function FluentTestProvider({ children }: { children: React.ReactNode }) {
  return <FluentProvider theme={defaultTheme}>{children}</FluentProvider>
}

export * from '@testing-library/react'
