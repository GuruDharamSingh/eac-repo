import type { Block } from "@elkdonis/blocks";
import { ORG, PLACES, SHOP_PIECE, WRITINGS, avatar, person, picture, potterBound, potterPiece } from "@/sample";
import { withSample } from "./util";
// Scoped copy of the app's palette and look sheets (selectors under [data-mock-app="katie-the-potter"]).
import "../mocks/katie-the-potter/katie-mock.css";

/** katie-the-potter: six blocks that do not pull in the cart (piece-block and artwork-grid do, and stay mocks). */
export async function load(): Promise<Block<never>[]> {
  const [about, details, row, landing, feed, strip] = await Promise.all([
    import("../../../../katie-the-potter/src/blocks/about-hero"),
    import("../../../../katie-the-potter/src/blocks/piece-details"),
    import("../../../../katie-the-potter/src/blocks/piece-row"),
    import("../../../../katie-the-potter/src/blocks/quick-landing"),
    import("../../../../katie-the-potter/src/blocks/studio-feed"),
    import("../../../../katie-the-potter/src/blocks/studio-strip"),
  ]);
  const potter = person("p2");
  return [
    withSample(about.aboutHero, {
      title: `About ${potter.name}`,
      story: `<p>${potter.bio}</p><p>${ORG.about}</p>`,
      signature: `${potter.name}, ${ORG.town}`,
      portrait: avatar(potter.name, potter.hue, 800),
      portraitAlt: `${potter.name}, shown as initials`,
      inset: picture(170, "", 400, 400),
      insetAlt: "A celadon bowl",
    }),
    withSample(details.pieceDetails, { artwork: SHOP_PIECE.id, bound: potterBound(), item: potterPiece(), nav: { prev: null, next: { title: WRITINGS[1].title, href: "/pieces/next" }, back: "/pieces" }, note: "Pay by card. Each piece is one of a kind and goes to whoever pays first." }),
    withSample(row.pieceRow, { heading: "From the kiln yard" }),
    withSample(landing.quickLanding),
    withSample(feed.studioFeed, {
      items: WRITINGS.slice(0, 3).map((w) => ({ id: w.id, title: w.title, href: `/journal/${w.slug}`, kind: "post", kicker: "Journal", excerpt: w.lede, cover: w.cover })),
    }),
    withSample(strip.studioStrip, {
      title: "Where the work happens",
      intro: PLACES[1].line,
      pictures: [PLACES[1], PLACES[0], PLACES[2]].map((p) => ({ src: p.image, alt: p.name, caption: p.name })),
      facts: [
        { label: "Clay", value: "White stoneware" },
        { label: "Firing", value: "Cone 6, Fridays" },
        { label: "Made in", value: ORG.town },
      ],
    }),
  ];
}
