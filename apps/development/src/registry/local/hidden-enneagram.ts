import type { Block } from "@elkdonis/blocks";
import { ARTWORKS, ORG, person, postView, shelfCards } from "@/sample";
import { withSample } from "./util";
// Scoped copy of the app's palette and site.css (selectors under [data-mock-app="hidden-enneagram"]).
import "../mocks/hidden-enneagram/he-mock.css";

/** hidden-enneagram: the quiet house blocks. None has a sample(), so the shared world fills them. */
export async function load(): Promise<Block<never>[]> {
  const [house, passage, post, shelf] = await Promise.all([
    import("../../../../hidden-enneagram/src/blocks/house"),
    import("../../../../hidden-enneagram/src/blocks/passage"),
    import("../../../../hidden-enneagram/src/blocks/post"),
    import("../../../../hidden-enneagram/src/blocks/shelf"),
  ]);
  const maren = person("p1");
  return [
    withSample(house.heWelcome, {
      heading: "Welcome.",
      subline: `A letter from ${maren.name}`,
      body: `<p>${ORG.about}</p><p>Come on a Thursday evening. The kettle is always on.</p>`,
      signature: maren.name.split(" ")[0],
      linkLabel: `About ${ORG.name}`,
      linkHref: "/about",
    }),
    withSample(house.heOrb, { size: "medium" }),
    withSample(house.heWorks, {
      items: ARTWORKS.slice(0, 4).map((a) => ({ picture: a.image, media: "", caption: `${a.title}, ${a.year}`, alt: a.alt })),
    }),
    withSample(passage.hePassage, {
      eyebrow: "The collective",
      heading: `What is ${ORG.name}?`,
      body: `<p>${ORG.about}</p><p>${ORG.tagline}</p>`,
      dropCap: true,
      links: [
        { label: "The open studio", note: "Thursdays, 7:30 pm", href: "/gatherings/open-studio" },
        { label: "Services", note: "Printmaking, pottery and walks", href: "/services" },
      ],
    }),
    withSample(post.hePost, { post: postView() }),
    withSample(shelf.heShelf, { eyebrow: "What we offer", heading: "Three ways to join in", intro: ORG.tagline, source: "services", limit: 3, items: shelfCards("services"), linkLabel: "All services", linkHref: "/services" }),
  ];
}

