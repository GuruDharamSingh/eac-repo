// ============================================================================
// The center's definition, as the page reads it. Structural twin of
// @elkdonis/services' CenterLayout (this package stays free of the data
// layer). A host resolves the layout on the server and hands it in; without
// one the page renders DEFAULT_CENTER_LAYOUT.
// ============================================================================

export type CenterSectionId =
  | "profile"
  | "buttons"
  | "orgs"
  | "promo"
  | "site"
  | "org"
  | "pinned"
  | "feed"
  | "featured"
  | "network";

export interface CenterLayout {
  columns: { left: CenterSectionId[]; right: CenterSectionId[] };
  hidden: CenterSectionId[];
  options: {
    feed?: { limit?: number };
    network?: { limit?: number };
    pinned?: { limit?: number };
    site?: { ratio?: "5:3" | "4:3" };
  };
  voice: "journal" | "gazette" | "quiet";
  /** 'columns' is the two orderly columns; 'desk' is the same sections loose. */
  arrangement: "columns" | "desk";
}

export const DEFAULT_CENTER_LAYOUT: CenterLayout = {
  columns: {
    left: ["profile", "buttons", "orgs", "promo"],
    right: ["site", "org", "pinned", "feed", "featured", "network"],
  },
  hidden: [],
  options: { feed: { limit: 12 }, network: { limit: 12 }, pinned: { limit: 6 }, site: { ratio: "5:3" } },
  voice: "journal",
  arrangement: "columns",
};
