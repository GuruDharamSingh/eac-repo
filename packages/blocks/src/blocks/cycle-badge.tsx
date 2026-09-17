import { defineBlock, type PropsOf } from "../registry";

// ============================================================================
// "Is it happening?"
//
// Lifted from cycle-badge.tsx, byte-identical in amrit-canada and
// innergathering. The original's comment is worth keeping intact, because it
// is a product decision rather than a styling one:
//
//   `pending` is stated as unconfirmed rather than hidden: silence about a 4am
//   gathering is itself information, and pretending otherwise would strand
//   people at a locked door.
//
// Two changes on the way in. The icons were lucide-react components; they are
// inline SVG here so the package carries no icon dependency for three glyphs.
// And the Tailwind semantic classes (border-primary/50, bg-destructive/10)
// became tokens, so the badge keeps its meaning on ifac and artdirect, which
// do not compile Tailwind over package source.
// ============================================================================

const props = [
  {
    name: "status",
    kind: "select",
    label: "Status",
    required: true,
    options: [
      { value: "confirmed", label: "Confirmed" },
      { value: "cancelled", label: "Cancelled" },
      { value: "pending", label: "Not yet confirmed" },
    ],
  },
] as const;

export type CycleBadgeProps = PropsOf<typeof props> & {
  /** Extra classes from the caller. Not a declared prop — not authored. */
  className?: string;
};

/** The three glyphs, as paths. Stroked, 24-box, matching the lucide originals. */
const GLYPH: Record<string, React.ReactNode> = {
  confirmed: (
    <>
      <path d="M8 2v4M16 2v4M3 10h18" />
      <path d="M21 14V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8" />
      <path d="m16 20 2 2 4-4" />
    </>
  ),
  cancelled: (
    <>
      <path d="M8 2v4M16 2v4M3 10h18" />
      <path d="M21 14V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8" />
      <path d="m17 17 4 4M21 17l-4 4" />
    </>
  ),
  pending: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </>
  ),
};

const LABEL: Record<string, string> = {
  confirmed: "Confirmed — it's on",
  cancelled: "Cancelled this cycle",
  pending: "Not yet confirmed",
};

export function CycleBadge({ status, className }: CycleBadgeProps) {
  // A status outside the three is a data problem, and guessing would be worse
  // than saying nothing: claiming a gathering is "on" when the row says
  // something unrecognised is exactly the locked-door failure.
  if (!status || !(status in LABEL)) return null;

  return (
    <span
      className={["blk", "blk-badge", className].filter(Boolean).join(" ")}
      data-status={status}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {GLYPH[status]}
      </svg>
      {LABEL[status]}
    </span>
  );
}

export const cycleBadge = defineBlock(
  {
    id: "cycle-badge",
    category: "content",
    label: "Happening / cancelled badge",
    description:
      "States whether this cycle of a recurring gathering is confirmed, cancelled, or not yet confirmed.",
    props,
    memberSafe: true,
    styling: "tokens",
  },
  CycleBadge,
  () => ({ status: "confirmed" as const })
);
