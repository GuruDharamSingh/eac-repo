import { StoreShowcase } from "@elkdonis/commerce/components";
import { defineBlock, type PropsOf } from "../registry";
import type { PersonBlockContext } from "../person-context";
import { PersonBlockNote, type PuckContext } from "./person-note";

// ============================================================================
// Their store — the marketplace listing a person page shows when the person
// has an active store and has switched the store section on.
//
// A person-page twin of profile-store without its "Whose store" field: on a
// person page the store is always the page's own person, and the loader
// (loadPersonBlockContext) has already applied the switch and the
// active-store check, as the plain page does.
// ============================================================================

const props = [
  { name: "heading", kind: "string", label: "Heading", default: "Store" },
  {
    name: "blurb",
    kind: "text",
    label: "Line under the heading",
    description: "Leave empty for the standard line about where the sale happens.",
    default: "",
  },
  {
    name: "density",
    kind: "select",
    label: "Card size",
    default: "normal",
    options: [
      { value: "tight", label: "Tight — more, smaller" },
      { value: "normal", label: "Normal" },
      { value: "loose", label: "Loose — fewer, larger" },
    ],
  },
] as const;

export type PersonStoreProps = PropsOf<typeof props> & {
  shop?: PersonBlockContext["store"];
  off?: boolean;
  puck?: PuckContext;
};

export function PersonStore({ heading = "Store", blurb, density = "normal", shop, off, puck }: PersonStoreProps) {
  if (off) return <PersonBlockNote puck={puck}>Your store is switched off in your page settings.</PersonBlockNote>;
  if (!shop) return <PersonBlockNote puck={puck}>No active store to show.</PersonBlockNote>;
  return (
    <div className="blk-person-section">
      <StoreShowcase
        store={shop.store}
        artworks={shop.artworks}
        marketplaceUrl={shop.marketplaceUrl}
        from={shop.from}
        heading={heading || "Store"}
        blurb={blurb || undefined}
        density={density as "tight" | "normal" | "loose"}
        className="eac-profile-store"
      />
    </div>
  );
}

export const personStore = defineBlock(
  {
    id: "person-store",
    category: "listings",
    label: "Their store",
    description: "What they have for sale on the marketplace, when their store is open and switched on.",
    props,
    memberSafe: true,
    styling: "tokens",
    dataDriven: true,
  },
  PersonStore,
  () => ({ heading: "Store", density: "normal" as const, shop: null })
);
