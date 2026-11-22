import type { Data } from "@puckeditor/core";
import type { MobileKey } from "./mobile-keys";
import { MOBILE_BLOCKS } from "./catalogue";
import { DEFAULT_BUTTONS } from "@/blocks/mobile/page-buttons-logic";
import { DEFAULT_ITEMS, DEFAULT_SHOW_ON } from "@/blocks/mobile/phone-menu-logic";

// The sticky footer menu, as a block in the three pages the shell's bar showed on (2026-11-21): the same three items, drawn the same.
const menu = (id: string) => n("m-phone-menu", { id: `m-phone-menu-${id}`, shape: "pill", items: DEFAULT_ITEMS, showOn: [...DEFAULT_SHOW_ON] });

// ============================================================================
// Code defaults for the phone documents (G2): the design as drawn, used until someone saves. No imports beyond
// types, so the client editor can read them too. Resolved keys (count, rows) are never part of a default.
// ============================================================================

/** A node with every prop the block declares: the published draw applies no defaults, so a stored node must carry them. */
const n = (type: string, props: Record<string, unknown>) => {
  const def = MOBILE_BLOCKS.find((b) => b.def.id === type)?.def;
  const base = Object.fromEntries((def?.props ?? []).filter((p) => p.default !== undefined).map((p) => [p.name, p.default]));
  return { type, props: { ...base, ...props } };
};

const doc = (title: string, content: { type: string; props: Record<string, unknown> }[]): Data =>
  ({ root: { props: { title } }, content, zones: {} }) as unknown as Data;

const pageTitle = (id: string, props: Record<string, unknown>) =>
  n("m-page-title", { id: `m-page-title-${id}`, readMoreHref: "/about", readMoreLabel: "Read more", showCount: false, countLabel: "", ...props });

export const MOBILE_DEFAULTS: Record<MobileKey, Data> = {
  // 01 Discover: every band as drawn; data bands hide themselves while there is nothing to show.
  "m-discover": doc("Discover", [
    // The heading is a sentence that begins with the city button (developer, canvas L1, 2026-11-16): the masthead
    // draws it, so the title block below carries only the intro and Read more.
    n("m-masthead", { id: "m-masthead-discover", line: "with Local Artists" }),
    pageTitle("discover", { kicker: "", tight: true, title: "", intro: "Tours and experiences led by people who live and work here." }),
    n("m-featured-tour", { id: "m-featured-tour-discover", sectionLabel: "Featured Tour", tourSlug: "" }),
    n("m-places-shelf", { id: "m-places-shelf-discover" }),
    // Wording from the developer's L1 canvas edit (2026-11-16); the label is drawn in capitals by .m-kicker.
    n("m-experiences-panel", {
      id: "m-experiences-panel-discover",
      label: "Experiences",
      heading: "Something Different",
      line: "Local Artists as an Encounter along the Way in Specific Tours coming Soon",
    }),
    n("m-guides", { id: "m-guides-discover" }),
    // The newest Feed post; the buttons under it (places catalogue, forum, log in / account / the office) are their own block.
    n("m-link-rows", { id: "m-link-rows-discover", showButtons: false }),
    n("m-page-buttons", { id: "m-page-buttons-discover", accountLabel: "Account", buttons: DEFAULT_BUTTONS }),
    menu("discover"),
  ]),
  // 02 Tours: the pilot.
  "m-tours": doc("Tours", [
    pageTitle("tours", {
      kicker: "",
      showCount: false,
      coverBackground: true,
      countLabel: "tours",
      title: "Tours",
      intro: "Walks, studios and tables, each led by a guide on set dates.",
    }),
    n("m-tour-list", {
        id: "m-tour-list-tours",
        showSearch: false,
        showChips: false,
        searchPlaceholder: "Search walks, ateliers, museums",
        chipAll: "All",
        chipWalks: "Walks",
        chipAteliers: "Ateliers",
        chipMuseums: "Museums",
        chipFood: "Food & markets",
        chipPrivate: "Private",
        withLabel: "with",
        emptyText: "Nothing matches that yet.",
      }),
    menu("tours"),
  ]),
  "m-experiences": doc("Experiences", [
    pageTitle("experiences", { kicker: "Paris · hosted by local artists", title: "Experiences", intro: "Something strange on the way, hosted by artists who live here." }),
    n("m-experience-list", { id: "m-experience-list-experiences" }),
    n("m-artists-row", { id: "m-artists-row-experiences" }),
    n("m-suggest-pill", { id: "m-suggest-pill-experiences" }),
    menu("experiences"),
  ]),
  "m-about": doc("About", [
    n("m-about-photo", { id: "m-about-photo-about" }),
    pageTitle("about", { kicker: "", title: "Elkdonis Experiences", intro: "", readMoreLabel: "", tight: true }),
    n("m-prose-sections", { id: "m-prose-sections-about" }),
    n("m-people-slider", { id: "m-people-slider-about" }),
    n("m-suggest-pill", { id: "m-suggest-pill-about" }),
  ]),
  "m-places": doc("Places", [
    pageTitle("places", { kicker: "Paris", title: "Places", intro: "Every stop, gallery and table the guides know well.", readMoreLabel: "" }),
    n("m-places-catalogue", { id: "m-places-catalogue-places" }),
  ]),
  "m-people": doc("Local Artists", [
    pageTitle("people", { kicker: "Paris", title: "Local Artists", intro: "The guides and artists behind the tours.", readMoreLabel: "" }),
    n("m-people-grid", { id: "m-people-grid-people" }),
  ]),
  "m-feed": doc("Feed", [
    pageTitle("feed", { kicker: "From the guides", title: "Feed", intro: "Posts and links the guides want to share.", readMoreLabel: "" }),
    n("m-feed-list", { id: "m-feed-list-feed" }),
  ]),
  // Record templates: filled by G3 and G4 (tour and experience blocks).
  "m-tour-detail": doc("Tour", [
    n("m-tour-topbar", { id: "m-tour-topbar-detail" }),
    n("m-tour-hero", { id: "m-tour-hero-detail" }),
    n("m-tour-head", { id: "m-tour-head-detail", showGuide: true }),
    n("m-tour-blurb", { id: "m-tour-blurb-detail" }),
    n("m-tour-meet", { id: "m-tour-meet-detail" }),
    n("m-tour-route", { id: "m-tour-route-detail" }),
    n("m-tour-dates", { id: "m-tour-dates-detail" }),
    n("m-tour-bookbar", { id: "m-tour-bookbar-detail" }),
  ]),
  "m-experience-detail": doc("Experience", [
    n("m-exp-hero", { id: "m-exp-hero-detail" }),
    n("m-exp-facts", { id: "m-exp-facts-detail" }),
    n("m-exp-body", { id: "m-exp-body-detail" }),
    n("m-exp-tours", { id: "m-exp-tours-detail" }),
    n("m-exp-dates", { id: "m-exp-dates-detail" }),
    n("m-exp-private", { id: "m-exp-private-detail" }),
  ]),
};
