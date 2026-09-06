const LABELS: Record<string, string> = {
  free: "Free",
  supported: "Supported",
  partner: "Partner",
};

/**
 * The org's tier as a small chip. Values come from organizations.tier
 * (free | supported | partner); anything else renders as-is rather than
 * hiding, so a new tier shows up instead of silently disappearing.
 */
export function TierBadge({ tier }: { tier: string }) {
  const label = LABELS[tier] ?? tier;
  const tone =
    tier === "partner"
      ? "border-primary/40 bg-primary/10 text-primary"
      : tier === "supported"
      ? "border-accent bg-accent text-accent-foreground"
      : "border-border bg-muted text-muted-foreground";
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${tone}`}
    >
      {label}
    </span>
  );
}
