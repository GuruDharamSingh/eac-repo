"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

/**
 * The toast host, in the root layout.
 *
 * `theme` is stated rather than read from `next-themes`.
 *
 * This used to call `useTheme()`, and there is no `<ThemeProvider>` anywhere in
 * this app — so the hook only ever returned its default, "system", which is
 * what is passed here now. What it also did was put a `useContext` call from a
 * dual-package dependency into the ROOT LAYOUT, on every route including the
 * two Next prerenders statically at build time (`/_not-found`,
 * `/_global-error`). Those two were the only static pages in the app, both died
 * with `Cannot read properties of null (reading 'useContext')` inside a Next
 * internal chunk, and the export aborted — which is why this app had no
 * production build for two weeks while its dev server carried the live domain.
 *
 * If a real theme switcher ever lands, it brings its own provider and this
 * reads from it again.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
