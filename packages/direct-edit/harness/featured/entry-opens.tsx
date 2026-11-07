// Harness: a visitor's page with blocks whose "Opens" the server resolved, the site's popups registered as in
// HubSurfaces, and the click bridge (components/surfaces/opens-popups.tsx), 2026-11-06.
import "@elkdonis/blocks/blocks.css";
import { createElement as h, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { SurfaceProvider, useSurfaceOptional } from "@elkdonis/cms-ui/surface";
import { LinkButton } from "/app/packages/blocks/src/blocks/link-button";
import { FeaturedPerson } from "/app/packages/blocks/src/blocks/featured-person";
import { PersonPopup, ReviewsPopup } from "/app/apps/elktours/src/components/surfaces/opens-popups";
import { bindOpensLinks } from "/app/apps/elktours/src/components/surfaces/opens-links";

const g = globalThis as any;
const DANA = { displayName: "Dana McCool", roleTitle: "Guide", bio: "Lives in the Marais.\n\nWalks every day.", photoUrl: null, href: "/about/danamccool", via: null };
const reviews = { href: "/tours/heritage", label: "Popup: reviews", popup: { key: "reviews", title: "Reviews of L'héritage", size: "standard", props: { type: "tour", id: "elkNapol001tour000003", title: "L'héritage", then: { href: "/tours/heritage", label: "See the tour and book" } } } };
const person = { href: "/about/danamccool", popup: { key: "person", title: "Dana McCool", size: "standard", props: { who: DANA, then: null } } };
const unknownKind = { href: "/somewhere", popup: { key: "whiteboard", props: {} } };
g.__nav = [];
window.addEventListener("click", (e) => { const a = (e.target as Element).closest("a"); if (a && !e.defaultPrevented) { e.preventDefault(); g.__nav.push(a.getAttribute("href")); } });

function Bridge() {
  const s = useSurfaceOptional();
  useEffect(() => (s?.open ? bindOpensLinks((d) => s.open(d), new Set(["tour", "experience", "reviews", "person"])) : undefined), [s?.open]);
  return null;
}
const connectors = { custom: { reviews: ({ descriptor }: any) => h(ReviewsPopup, { descriptor }), person: ({ descriptor }: any) => h(PersonPopup, { descriptor }) } };
createRoot(document.getElementById("host")!).render(
  h(SurfaceProvider as any, { connectors }, h(Bridge),
    h("main", { style: { padding: 24 } },
      h("div", { id: "b-reviews" }, h(LinkButton as any, { label: "Read the reviews", href: "/typed", opened: reviews })),
      h("div", { id: "b-plain" }, h(LinkButton as any, { label: "Plain link", href: "/typed" })),
      h("div", { id: "b-unknown" }, h(LinkButton as any, { label: "Unknown kind", href: "/typed", opened: unknownKind })),
      h("div", { id: "fp" }, h(FeaturedPerson as any, { person: "user:x", who: DANA, opened: person })))));
