"use client";

import * as React from "react";
import { cn } from "./cn";

export interface CountdownTimerProps {
  /** ISO 8601 timestamp the countdown is targeting */
  endAt: string;
  /** Called once when the countdown crosses 0 */
  onEnd?: () => void;
  /** Visual treatment */
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Real-time countdown timer (HH:MM:SS, or D days HH:MM if > 24h away).
 * Pure client-side; no network. Pair with a server-side end_at value.
 */
export function CountdownTimer({ endAt, onEnd, size = "md", className }: CountdownTimerProps) {
  const target = React.useMemo(() => new Date(endAt).getTime(), [endAt]);
  const [now, setNow] = React.useState(() => Date.now());
  const onEndRef = React.useRef(onEnd);
  onEndRef.current = onEnd;

  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = Math.max(0, target - now);
  const ended = diff === 0;
  React.useEffect(() => {
    if (ended) onEndRef.current?.();
  }, [ended]);

  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);

  const sizes = {
    sm: "text-sm",
    md: "text-2xl",
    lg: "text-4xl",
  }[size];

  if (ended) {
    return (
      <span className={cn("font-serif tabular-nums text-muted-foreground", sizes, className)}>
        Ended
      </span>
    );
  }

  if (days > 0) {
    return (
      <span className={cn("font-serif tabular-nums", sizes, className)}>
        {days}d {pad(hours)}:{pad(minutes)}:{pad(seconds)}
      </span>
    );
  }
  return (
    <span className={cn("font-serif tabular-nums", sizes, className)}>
      {pad(hours)}:{pad(minutes)}:{pad(seconds)}
    </span>
  );
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}
