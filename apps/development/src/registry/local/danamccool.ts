import type { Block } from "@elkdonis/blocks";
import { ARTWORKS, GALLERIES, ORG, artworkBound, artworkItems, shelfItemsOfWritings } from "@/sample";
import { withSample } from "./util";
// Scoped copy of the app's palette and block rules (selectors under [data-mock-app="danamccool"]).
import "../mocks/danamccool/dana-mock.css";

/**
 * danamccool: the page blocks (the gallery grid is a mock already). Artwork blocks bind to artworks through
 * `bound` (a resolver key); here `bound` and `items` come from the shared world's artworks.
 */
export async function load(): Promise<Block<never>[]> {
  const [wall, banner, career, circle, nav, feature, imageSet, invitation, opening, plate, press, star, shelf] = await Promise.all([
    import("../../../../danamccool/src/blocks/artwork-wall"),
    import("../../../../danamccool/src/blocks/banner"),
    import("../../../../danamccool/src/blocks/career-timeline"),
    import("../../../../danamccool/src/blocks/circle-text"),
    import("../../../../danamccool/src/blocks/collection-nav"),
    import("../../../../danamccool/src/blocks/feature-grid"),
    import("../../../../danamccool/src/blocks/image-set"),
    import("../../../../danamccool/src/blocks/invitation"),
    import("../../../../danamccool/src/blocks/opening"),
    import("../../../../danamccool/src/blocks/plate"),
    import("../../../../danamccool/src/blocks/press-quotes"),
    import("../../../../danamccool/src/blocks/star-diamond"),
    import("../../../../danamccool/src/blocks/writing-shelf"),
  ]);
  const colour = ARTWORKS.filter((a) => a.artistId === "p5");
  return [
    withSample(wall.artworkWall, { heading: GALLERIES[0].title, source: "gallery", items: artworkItems().filter((a) => GALLERIES[0].artworkIds.includes(a.id)), bound: artworkBound() }),
    withSample(banner.banner),
    withSample(career.careerTimeline),
    withSample(circle.circleText, { artwork: colour[0].id, bound: artworkBound(), heading: colour[0].title, body: `${colour[0].medium}, ${colour[0].size}. ${ORG.tagline}`, showSale: true }),
    withSample(nav.collectionNav, { heading: "Collections", tiles: GALLERIES.map((g) => ({ image: ARTWORKS.find((a) => a.id === g.artworkIds[0])?.image ?? "", label: g.title, link: "", key: g.id })) }),
    withSample(feature.featureGrid),
    withSample(imageSet.imageSet, {
      title: "Studio pictures",
      intro: GALLERIES[0].blurb,
      pictures: colour.map((a) => ({ artwork: a.id, src: "", alt: a.alt, caption: `${a.title}, ${a.year}` })),
      bound: artworkBound(),
    }),
    withSample(invitation.invitation),
    withSample(opening.opening),
    withSample(plate.plate, { artwork: colour[1].id, bound: artworkBound(), headings: colour[1].title, body: `${colour[1].medium}, ${colour[1].size}.` }),
    withSample(press.pressQuotes),
    withSample(star.starDiamond),
    withSample(shelf.writingShelf, { items: shelfItemsOfWritings() }),
  ];
}
