import { Fragment } from "react";
import { defineBlock, type PropsOf } from "@elkdonis/blocks";
import { sized, srcSet } from "./media";
import { artworkProp, captionOf, isForSale, lookup, pick, type Bound } from "./artwork-data";
import { galleryIdOf, NEST_DEPTH, type Nested, type NestedGallery } from "./nested";

// ============================================================================
// An image set — the unit her old site (Format) was built from.
//
// Every gallery on it is the same shape: a heading band ("OCAD UNIVERSITY —
// GRADEX 103 EXHIBITION"), then a grid of small pictures, and clicking one
// shows it at full size. Her Medicine Buddha page is two of these; the
// resin sculptures, Universal Pharmacy and the figurative pages are one each.
//
// Why not `picture-wall`: that one serves every picture at its MASTER size and
// has no way to look at one larger, which is the whole point of a thumbnail.
//
// The full-size view needs no JavaScript. Each thumbnail links to a fragment,
// and the matching overlay is shown by `:target` — so it works on a published
// page with no client bundle, the browser's Back button closes it, and a
// picture can be linked to directly. The overlay's own links step to the
// previous and next picture the same way.
//
// BOUND OR TYPED, per picture (see artwork-data.ts): a row can name one of
// her artworks, and its picture, description and caption come from the
// record — with an enquire link in the full-size view while it is for sale.
// A row can equally be a plain picture from storage, which is what most
// exhibition and detail shots are. Typed values win over bound ones.
//
// NESTED GALLERIES: a row can also OPEN one of her galleries. Its full-size
// view then offers "Enter <gallery>" (and a few of its thumbnails); going in,
// the arrows step through THAT gallery, and a trail at the top leads back up
// to the picture the visitor came from. Still no JavaScript: every level is
// one more set of `:target` overlays, anchored under the picture that opens
// it, so Back works at every depth. See nested.ts for depth and loops.
// ============================================================================

const props = [
  { name: "title", kind: "string", label: "Heading", default: "", inlineEditable: true },
  { name: "intro", kind: "text", label: "A few words under the heading", default: "" },
  {
    name: "pictures",
    kind: "rows",
    label: "Picture",
    addLabel: "Add a picture",
    summary: ["caption", "alt", "artwork"],
    fields: [
      artworkProp("Artwork (optional)"),
      { name: "src", kind: "image", label: "Image", description: "Leave empty to use the chosen artwork's picture." },
      {
        name: "alt",
        kind: "string",
        label: "Description",
        description: "What the picture shows, for anyone who cannot see it.",
        default: "",
      },
      { name: "caption", kind: "string", label: "Caption", default: "" },
      {
        name: "opens",
        kind: "string",
        binds: "opens-gallery",
        label: "Opens a gallery (optional)",
        description:
          "In the full-size view, visitors can go into this gallery instead of stepping on through this set.",
        default: "",
      },
    ],
  },
  {
    name: "min",
    kind: "number",
    label: "Thumbnail size",
    description: "The browser fits as many across as this allows.",
    default: 150,
    min: 80,
    max: 420,
    step: 10,
    unit: "px",
  },
  {
    name: "shape",
    kind: "select",
    label: "Thumbnails",
    default: "fit",
    options: [
      { value: "fit", label: "Whole picture (as her old site)" },
      { value: "square", label: "Cropped square" },
      { value: "circle", label: "Circle" },
    ],
  },
  {
    name: "band",
    kind: "boolean",
    label: "Heading in a band",
    description: "The heading sits in its own box above the pictures, the way her galleries were titled.",
    default: true,
  },
] as const;

export type ImageSetProps = PropsOf<typeof props> & { bound?: Bound; nested?: Nested };

/** A step back up the trail: the picture that led deeper, and its set's name. */
interface Crumb {
  label: string;
  href: string;
}

/** Enough overlays for any real page; stops a web of cross-links growing the HTML without end. */
const MAX_OVERLAYS = 800;

/** "Enter <gallery>" and a few of its thumbnails, under a picture that opens one. */
function Into({ gallery, anchor }: { gallery: NestedGallery; anchor: string }) {
  const first = gallery.items.slice(0, 5);
  return (
    <div className="dm-set-into">
      <a className="dm-set-into-go" href={`#${anchor}-in-1`}>
        Enter <em>{gallery.title}</em> ({gallery.items.length}) <span aria-hidden="true">→</span>
      </a>
      <ul className="dm-set-into-strip" aria-label={`In ${gallery.title}`}>
        {first.map((p, k) => (
          <li key={k}>
            <a href={`#${anchor}-in-${k + 1}`} aria-label={p.title || `Picture ${k + 1} of ${gallery.title}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sized(p.url, 256)} alt="" loading="lazy" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The overlays for one nested gallery, entered from the picture at `parent`,
 * and — recursively — for every gallery its pictures open. `seen` is the
 * trail of galleries already entered: one of them is never entered again.
 */
function NestedLevel({
  gallery,
  parent,
  closeHref,
  trail,
  seen,
  nested,
  budget,
}: {
  gallery: NestedGallery;
  parent: string;
  closeHref: string;
  trail: Crumb[];
  seen: string[];
  nested: Nested;
  budget: { left: number };
}) {
  const anchor = (j: number) => `${parent}-in-${j + 1}`;
  const items = gallery.items;
  return (
    <>
      {items.map((p, j) => {
        if (budget.left-- <= 0) return null;
        const child = p.opens && !seen.includes(p.opens) && seen.length < NEST_DEPTH ? nested[p.opens] : undefined;
        const into = child && child.items.length > 0 ? child : undefined;
        const prev = j > 0 ? anchor(j - 1) : null;
        const next = j < items.length - 1 ? anchor(j + 1) : null;
        return (
          <Fragment key={j}>
            <div className="dm-set-full" id={anchor(j)} role="group" aria-label={p.title || p.caption || `Picture ${j + 1}`}>
              <nav className="dm-set-trail" aria-label="Where you are">
                {trail.map((c, n) => (
                  <span key={n}>
                    <a href={c.href}>{c.label}</a>
                    <span aria-hidden="true"> ›</span>
                  </span>
                ))}
                <span aria-current="location">
                  {gallery.title} <span className="dm-set-trail-count">{j + 1} / {items.length}</span>
                </span>
              </nav>
              <a className="dm-set-close" href={closeHref} aria-label="Close">
                ×
              </a>
              <figure className="dm-set-figure">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sized(p.url, 1024)} alt={p.title} loading="lazy" />
                {p.caption || p.href ? (
                  <figcaption>
                    {p.caption}
                    {p.href ? (
                      <>
                        {" "}
                        <a className="dm-set-sale" href={p.href} target="_blank" rel="noopener noreferrer">
                          Enquire / buy<span className="dm-sr"> (opens in a new tab)</span>
                        </a>
                      </>
                    ) : null}
                  </figcaption>
                ) : null}
                {into ? <Into gallery={into} anchor={anchor(j)} /> : null}
              </figure>
              {prev ? (
                <a className="dm-set-step dm-set-step--prev" href={`#${prev}`} aria-label="Previous picture">
                  ‹
                </a>
              ) : null}
              {next ? (
                <a className="dm-set-step dm-set-step--next" href={`#${next}`} aria-label="Next picture">
                  ›
                </a>
              ) : null}
            </div>
            {into ? (
              <NestedLevel
                gallery={into}
                parent={anchor(j)}
                closeHref={closeHref}
                trail={[...trail, { label: gallery.title, href: `#${anchor(j)}` }]}
                seen={[...seen, into.id]}
                nested={nested}
                budget={budget}
              />
            ) : null}
          </Fragment>
        );
      })}
    </>
  );
}

/** Fragment ids must be unique on a page that holds several sets. */
function slugOf(title: string, fallback: string): string {
  const s = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return s || fallback;
}

export function ImageSet({
  title,
  intro,
  pictures,
  min = 150,
  shape = "fit",
  band = true,
  id,
  bound,
  nested = {},
}: ImageSetProps & { id?: string }) {
  // Each row resolved to what it will actually show: typed values first,
  // then the bound artwork's, then nothing.
  const shown = (pictures ?? [])
    .map((p) => {
      const item = lookup(bound, p.artwork);
      return {
        src: pick(p.src, item?.image),
        alt: pick(p.alt, item?.title),
        caption: pick(p.caption, captionOf(item)),
        sale: item && isForSale(item) && item.href ? item : null,
        opens: galleryIdOf(p.opens),
      };
    })
    .filter((p) => p.src);
  const heading = typeof title === "string" ? title.trim() : title;
  if (shown.length === 0 && !heading) return null;

  // The editor gives every block an id; a hand-written page may not. The
  // title is the readable half, the id keeps two same-titled sets apart.
  const base = `set-${slugOf(typeof title === "string" ? title : "", "pictures")}${
    id ? `-${String(id).slice(-6)}` : ""
  }`;
  const anchor = (i: number) => `${base}-${i + 1}`;
  const budget = { left: MAX_OVERLAYS };
  const setLabel = (typeof title === "string" && title.trim()) || "Pictures";

  return (
    <section className="dm-set" data-band={band ? "true" : "false"} id={base}>
      {heading ? <h2 className="dm-set-title">{heading as string}</h2> : null}
      {intro ? <p className="dm-set-intro">{intro}</p> : null}

      <ul
        className="dm-set-grid"
        data-shape={shape}
        style={{ ["--dm-set-min" as string]: `${min}px` }}
      >
        {shown.map((p, i) => {
          const src = String(p.src);
          const alt = String(p.alt ?? "");
          return (
            <li key={i} className="dm-set-cell">
              <a className="dm-set-thumb" href={`#${anchor(i)}`} aria-label={alt || `Picture ${i + 1}, full size`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sized(src, 256)}
                  srcSet={srcSet(src)}
                  sizes={`${Math.max(min, 120)}px`}
                  alt=""
                  loading="lazy"
                />
              </a>
            </li>
          );
        })}
      </ul>

      {shown.map((p, i) => {
        const src = String(p.src);
        const alt = String(p.alt ?? "");
        const caption = p.caption;
        const into = p.opens && nested[p.opens]?.items.length ? nested[p.opens] : undefined;
        const prev = i > 0 ? anchor(i - 1) : null;
        const next = i < shown.length - 1 ? anchor(i + 1) : null;
        return (
          <Fragment key={i}>
          <div className="dm-set-full" id={anchor(i)} role="group" aria-label={alt || caption || `Picture ${i + 1}`}>
            <a className="dm-set-close" href={`#${base}`} aria-label="Close">
              ×
            </a>
            <figure className="dm-set-figure">
              {/* Loaded only when opened — `lazy` on a display:none image
                  defers it until :target shows it. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sized(src, 1024)} alt={alt} loading="lazy" />
              {caption || p.sale ? (
                <figcaption>
                  {caption}
                  {p.sale ? (
                    <>
                      {" "}
                      <a className="dm-set-sale" href={p.sale.href!} target="_blank" rel="noopener noreferrer">
                        Enquire / buy<span className="dm-sr"> (opens in a new tab)</span>
                      </a>
                    </>
                  ) : null}
                </figcaption>
              ) : null}
              {into ? <Into gallery={into} anchor={anchor(i)} /> : null}
            </figure>
            {prev ? (
              <a className="dm-set-step dm-set-step--prev" href={`#${prev}`} aria-label="Previous picture">
                ‹
              </a>
            ) : null}
            {next ? (
              <a className="dm-set-step dm-set-step--next" href={`#${next}`} aria-label="Next picture">
                ›
              </a>
            ) : null}
          </div>
          {into ? (
            <NestedLevel
              gallery={into}
              parent={anchor(i)}
              closeHref={`#${base}`}
              trail={[{ label: setLabel, href: `#${anchor(i)}` }]}
              seen={[into.id]}
              nested={nested}
              budget={budget}
            />
          ) : null}
          </Fragment>
        );
      })}
    </section>
  );
}

export const imageSet = defineBlock(
  {
    id: "dm-image-set",
    label: "Image set",
    category: "listings",
    description:
      "A titled set of small pictures; click one to see it full size. The shape every gallery on her old site took.",
    memberSafe: true,
    styling: "tokens",
    props,
  },
  ImageSet,
  () => ({
    title: "An image set",
    intro: "",
    pictures: [],
    min: 150,
    shape: "fit" as const,
    band: true,
  })
);
