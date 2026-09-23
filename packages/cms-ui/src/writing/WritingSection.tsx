import type { ReactNode } from "react";
import { WritingShelf, type ShelfItem } from "./WritingShelf";

/**
 * A member's writing, as a section on their profile page.
 *
 * The shelf itself was already shared; what was not was the SECTION around it
 * — the frame, the owner's affordances, and the link to the rest. That lived
 * in apps/ifac, so every other org either went without or rebuilt a plainer
 * version of the same thing (innergathering did exactly that).
 *
 * Deliberately NOT a data component: it takes `items`, so the host decides
 * what a person's writing means — whether to read drafts, and whether to scope
 * to this org or across the whole network (the page owner's `blogScope`). This
 * package does not import the data layer.
 *
 * Two affordances, both owner-only and both passed IN rather than assumed:
 * `startPiece` is a server action bound to a particular author, and only the
 * host knows its own. The "all writing" link is derived from `basePath`.
 */
export interface WritingSectionProps {
  items: ShelfItem[];
  /** Where a piece lives: `${basePath}/${slug}`. Also the "all writing" link. */
  basePath: string;
  /** The viewer may edit this person's writing: drafts show, and so does `startPiece`. */
  editable?: boolean;
  /** The owner's "start a piece" control — `<StartPiece …/>`, bound by the host. */
  startPiece?: ReactNode;
  /** How many to show before the section defers to its own page. */
  limit?: number;
  heading?: string;
  /** The host's own frame, if it has one. IFAC passes `profile-writing`. */
  className?: string;
  /** Live-edit style pins, for hosts that use them. */
  themeVars?: string;
  themeLabel?: string;
}

export function WritingSection({
  items,
  basePath,
  editable = false,
  startPiece,
  limit = 4,
  heading = "Writing",
  className,
  themeVars,
  themeLabel,
}: WritingSectionProps) {
  // The owner sees the section even while it is empty — a section you turned
  // on should show you what it is for. Everyone else sees nothing at all.
  if (items.length === 0 && !editable) return null;

  const shown = items.slice(0, limit);
  const more = items.length > limit;

  return (
    <section
      className={["eac-writing-section", className].filter(Boolean).join(" ")}
      data-theme-vars={themeVars}
      data-theme-label={themeLabel}
    >
      <WritingShelf
        items={shown}
        basePath={basePath}
        heading={heading}
        showDrafts={editable}
        emptyNote={
          editable
            ? "Nothing here yet. Start a piece — it stays a draft until you publish it."
            : "Nothing published yet."
        }
      >
        {startPiece}
        {more && (
          <p className="eac-writing-more">
            <a href={basePath}>All writing →</a>
          </p>
        )}
      </WritingShelf>
    </section>
  );
}
