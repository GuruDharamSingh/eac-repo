import type { OfferKind, SurfaceLook } from "@elkdonis/cms-ui/offer-surface";
import type { TemplateId } from "@elkdonis/cms-ui/offer-templates/types";

/**
 * What the hub's "Current Work Page" card shows and edits, for one org. Plain data (no server code),
 * shared by the loader (offer-card.ts), the save actions' reader (offer-card-actions.ts) and the card.
 */

export const KIND_WORD: Record<OfferKind, string> = {
  event: "Event",
  service: "Service",
  series: "Series",
  artwork: "Artwork",
  writing: "Writing",
};

export interface CurrentWorkData {
  orgSlug: string;
  orgName: string;
  /** The org's public address, for "View the site". */
  siteUrl: string;
  /** `offer:look.enabled`: the site draws the new page. */
  enabled: boolean;
  look: Required<Pick<SurfaceLook, "font" | "icons" | "mark" | "tint">> & { sheet: "natural" | "level" };
  /** What the site draws instead while the new page is off, in a sentence that finishes "Your site shows ...". */
  drawsInstead: string;
  /** The piece that leads the page now (the chosen one, else the automatic pick); null when nothing is public yet. */
  featured: null | {
    key: string;
    kind: OfferKind;
    title: string;
    cover: string | null;
    /** true: stored in `offer:featured`; false: the automatic pick. */
    chosen: boolean;
    template: TemplateId;
  };
}
