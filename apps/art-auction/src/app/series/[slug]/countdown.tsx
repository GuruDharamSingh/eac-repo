"use client";

import * as React from "react";

/** "26d 05h 12m" to a moment, ticking each minute (each second in the last hour). */
export function Countdown({ to, className }: { to: string; className?: string }) {
  const target = new Date(to).getTime();
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), target - Date.now() < 3600_000 ? 1000 : 30_000);
    return () => clearInterval(t);
  }, [target]);
  if (now == null) return <strong className={className}>&nbsp;</strong>;
  const left = Math.max(0, target - now);
  const d = Math.floor(left / 86_400_000);
  const h = Math.floor((left % 86_400_000) / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const text = left === 0 ? "now" : d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m` : `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
  return <strong className={className}>{text}</strong>;
}
