/** What the phone's tour quick view needs, read through tourQuickAction. Plain data: safe to import from client files. */
export interface TourQuick {
  slug: string;
  title: string;
  typeLabel: string | null;
  cover: string | null;
  guide: { name: string; craft: string | null; photo: string | null } | null;
  facts: { label: string; value: string }[];
  /** Plain text, no markup. */
  blurb: string | null;
  slots: { slotId: string; day: string; left: string }[];
  priced: boolean;
  hasRoute: boolean;
}
