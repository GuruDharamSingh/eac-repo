// ============================================================================
// Which looks the hub can wear.
//
// Data ONLY — no import of @elkdonis/db, and that is the point rather than a
// coincidence. `AppearanceCard` is a client component and needs this list to
// draw the select; when the list and the queries shared a module, importing
// it pulled `postgres` into the browser bundle and the whole hub answered 500.
// tsc is perfectly happy with that, so the split is the only thing preventing
// it. The queries live in ./hub-skin-store, which is server-only.
//
// A skin is NOT a theme. `site_themes` holds colour VARIABLES — an editor
// nudging --paper two shades warmer — and the live editor already owns that.
// A skin is a named arrangement: different type, different card construction,
// different rules. Those are CSS rules, not values, so they cannot be
// expressed as a var bag.
// ============================================================================

export const HUB_SKINS = [
  {
    key: "basic",
    label: "Basic",
    note: "Cream cards on paper. The network's shared hub language.",
  },
  {
    key: "salon",
    label: "Salon",
    note: "The gallery after hours — dark ground, gilt rules, wall labels.",
  },
] as const;

export type HubSkin = (typeof HUB_SKINS)[number]["key"];

export const DEFAULT_HUB_SKIN: HubSkin = "basic";

export function isHubSkin(value: unknown): value is HubSkin {
  return typeof value === "string" && HUB_SKINS.some((s) => s.key === value);
}
