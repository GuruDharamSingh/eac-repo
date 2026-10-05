import { defineBlock, type PropsOf } from "@elkdonis/blocks";

// ============================================================================
// An image card with the title laid over the picture.
//
// Source:  HyperUI "Cards" 3 — public/examples/marketing/cards/3.html
//          https://github.com/markmead/hyperui (MIT, Copyright (c) Mark Mead;
//          see ./NOTICE.md)
//
// Changes: the Unsplash <img> is the `image` prop (empty = no picture). The
// text that HyperUI reveals on hover is always visible, since touch screens
// have no hover. A bottom gradient is added so the words stay readable on any
// picture. Colours are deliberately NOT tokens here: text over a photograph
// needs a fixed pair, and the card keeps HyperUI's `bg-black` + white text
// (the same in light and dark). The kicker is white at 80% rather than
// HyperUI's pink-500, which has no token. Link is optional; without it the
// card is a <div>. `m-0` on <p> and <h3>.
// ============================================================================

const props = [
  { name: "image", kind: "image", label: "Picture", description: "Shown behind the words." },
  { name: "kicker", kind: "string", label: "Small line above", default: "", inlineEditable: true },
  { name: "title", kind: "string", label: "Title", default: "", inlineEditable: true },
  { name: "text", kind: "text", label: "Text", default: "", inlineEditable: true },
  { name: "href", kind: "url", label: "Card goes to", default: "" },
  { name: "label", kind: "string", label: "Link words", description: "Shown when the card has a link.", default: "" },
] as const;

export type CardImageProps = PropsOf<typeof props>;

/** Links an author types are rendered on public pages: keep to safe schemes. */
function safeHref(href: string | undefined): string | undefined {
  const h = String(href ?? "").trim();
  return /^(\/(?!\/)|#|https?:\/\/|mailto:|tel:)/i.test(h) ? h : undefined;
}

export function CardImage({ image, kicker, title, text, href, label }: CardImageProps) {
  if (!title && !text && !image) return null;
  const link = safeHref(href);
  // No picture yet: a gradient from the site's accent into its ink, instead of a black slab.
  const cls = `group relative block overflow-hidden text-white no-underline ${image ? "bg-black" : "bg-gradient-to-br from-primary to-foreground"}`;

  const inner = (
    <>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          src={image}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover opacity-75 transition-opacity group-hover:opacity-50"
        />
      ) : null}
      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" aria-hidden="true"></div>

      <div className="relative p-4 sm:p-6 lg:p-8">
        {kicker ? (
          <p className="m-0 text-sm font-medium tracking-widest text-white/80 uppercase">{kicker}</p>
        ) : null}
        {title ? <h3 className="m-0 text-xl font-bold text-white sm:text-2xl">{title}</h3> : null}

        <div className="mt-32 sm:mt-48 lg:mt-64">
          {text ? <p className="m-0 max-w-sm text-sm text-white">{text}</p> : null}
          {link && label ? (
            <span className="mt-3 inline-block text-sm font-medium text-white underline underline-offset-4">
              {label}
            </span>
          ) : null}
        </div>
      </div>
    </>
  );

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      {link ? (
        <a href={link} className={cls}>
          {inner}
        </a>
      ) : (
        <div className={cls}>{inner}</div>
      )}
    </div>
  );
}

export const cardImage = defineBlock(
  {
    id: "ha-card-image",
    label: "Image card",
    category: "listings",
    description: "A picture with a small line, a title and a few words over it, linking somewhere.",
    memberSafe: true,
    styling: "tailwind",
    props,
  },
  CardImage,
  () => ({
    image: "",
    kicker: "Open studio",
    title: "Saturday at the print room",
    text: "Meet the printmakers and watch an edition come off the press.",
    href: "/",
    label: "See what is on",
  })
);
