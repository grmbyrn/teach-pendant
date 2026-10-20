import { Navigate, createBrowserRouter, type RouteObject } from 'react-router-dom'

import { AppShell } from './AppShell'

/**
 * Routes as data, not as nested JSX. The array is exported on its own so
 * tests can mount the same route table in a memory router - the test and the
 * app then cannot drift apart.
 *
 * Each feature is loaded through `lazy`, so its code is a separate chunk that
 * the device only downloads and parses when the operator opens that screen.
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      // No landing screen: an operator opening the pendant wants live state.
      { index: true, element: <Navigate to="/monitoring" replace /> },
      {
        path: 'monitoring',
        lazy: async () => {
          const { MonitoringPage } = await import('@packages/monitoring')
          return { Component: MonitoringPage }
        },
      },
      {
        path: 'jogging',
        lazy: async () => {
          const { JoggingPage } = await import('@packages/jogging')
          return { Component: JoggingPage }
        },
      },
      // A dead-end URL must never leave an operator on a blank screen.
      { path: '*', element: <Navigate to="/monitoring" replace /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
