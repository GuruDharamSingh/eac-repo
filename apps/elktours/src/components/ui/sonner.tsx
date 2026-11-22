"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { useIsMobile } from "@/components/mobile/use-is-mobile"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  // Below md: top-centre ivory pill, 2.6s. Desktop keeps the caller's position and the popover look.
  const mobile = useIsMobile()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
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
          "--normal-bg": mobile ? "hsl(var(--foreground))" : "var(--popover)",
          "--normal-text": mobile ? "hsl(var(--primary-foreground))" : "var(--popover-foreground)",
          "--normal-border": mobile ? "transparent" : "var(--border)",
          "--border-radius": mobile ? "22px" : "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
      {...(mobile ? { position: "top-center" as const, duration: 2600 } : {})}
    />
  )
}

export { Toaster }
