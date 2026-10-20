import { StrictMode } from 'react'

import { FluentProvider } from '@fluentui/react-components'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'

import { defaultTheme } from './theme/themes'
import { router } from './router'
import './global.css'

const container = document.getElementById('root')
if (!container) {
  // Fail loudly at startup rather than rendering nothing.
  throw new Error('Root element #root not found in index.html')
}

createRoot(container).render(
  <StrictMode>
    {/* One provider at the root: it injects the design tokens that every
        makeStyles rule below it reads. */}
    <FluentProvider theme={defaultTheme}>
      <RouterProvider router={router} />
    </FluentProvider>
  </StrictMode>,
)
