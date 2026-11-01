import { defineBlock, type PropsOf } from "@elkdonis/blocks";

// ============================================================================
// The org's offering, as a card.
//
// What `/offering` promotes as a whole page — the pinned thread, else the
// newest published public one — drawn as one card on the designed landing
// page. Data-driven: the block stores only its settings and the resolver
// (`lib/puck/data.ts`) fills `offering` from the org named in the page's
// metadata, so one document serves whichever org opened the editor.
//
// Tailwind on purpose (`styling: "tailwind"`): this block lives in the app's
// own `src/blocks/` and is compiled with the app, which is where the Puck
// rules say a Tailwind block belongs.
// ============================================================================

export interface OfferingRecord {
  id: string;
  title: string;
  kind: string;
  href: string;
  excerpt: string | null;
  /** ISO string; the resolver never sends a Date (Puck deep-copies one into `{}`). */
  scheduledAt: string | null;
  location: string | null;
  price: string | null;
  currency: string | null;
  coverImageUrl: string | null;
  pinned: boolean;
}

const props = [
  { name: "heading", kind: "string", label: "Heading", default: "Now", inlineEditable: true },
  { name: "showImage", kind: "boolean", label: "Show the cover image", default: true },
  { name: "showExcerpt", kind: "boolean", label: "Show the summary", default: true },
  { name: "buttonLabel", kind: "string", label: "Button", default: "Read more", inlineEditable: true },
  {
    name: "emptyMessage",
    kind: "string",
    label: "Message when nothing is published",
    default: "Nothing on offer just now. Check back soon.",
  },
] as const;

export type AcOfferingProps = PropsOf<typeof props> & { offering?: OfferingRecord | null };

const KIND_LABEL: Record<string, string> = {
  post: "Essay",
  meeting: "Gathering",
  event: "Event",
  service: "Offering",
  workshop: "Workshop",
  series: "Series",
};

function when(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function AcOffering({
  heading = "Now",
  showImage = true,
  showExcerpt = true,
  buttonLabel = "Read more",
  emptyMessage = "Nothing on offer just now. Check back soon.",
  offering,
}: AcOfferingProps) {
  return (
    <section className="mx-auto w-full max-w-3xl px-6 py-10" data-block="ac-offering">
      {heading ? (
        <h2 className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">{heading}</h2>
      ) : null}
      {!offering ? (
        <p className="mt-3 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <article className="mt-4 grid gap-6 rounded-lg border border-border bg-card p-6 sm:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {offering.pinned ? "Featured" : "Latest"} · {KIND_LABEL[offering.kind] ?? offering.kind}
            </p>
            <h3 className="mt-2 font-serif text-3xl leading-tight">
              <a href={offering.href} className="hover:underline underline-offset-4">
                {offering.title}
              </a>
            </h3>
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              {when(offering.scheduledAt) && (
                <div>
                  <dt className="sr-only">When</dt>
                  <dd>{when(offering.scheduledAt)}</dd>
                </div>
              )}
              {offering.location && (
                <div>
                  <dt className="sr-only">Where</dt>
                  <dd>{offering.location}</dd>
                </div>
              )}
              {offering.price != null && Number(offering.price) > 0 && (
                <div>
                  <dt className="sr-only">Price</dt>
                  <dd>
                    {offering.currency ?? "CAD"} {offering.price}
                  </dd>
                </div>
              )}
            </dl>
            {showExcerpt && offering.excerpt && (
              <p className="mt-4 text-base leading-relaxed text-foreground/90">{offering.excerpt}</p>
            )}
            {buttonLabel ? (
              <p className="mt-5">
                <a
                  href={offering.href}
                  className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  {buttonLabel}
                </a>
              </p>
            ) : null}
          </div>
          {showImage && offering.coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={offering.coverImageUrl}
              alt=""
              className="h-40 w-full rounded-md border border-border object-cover sm:h-44 sm:w-44"
            />
          )}
        </article>
      )}
    </section>
  );
}

export const acOffering = defineBlock(
  {
    id: "ac-offering",
    label: "Offering card",
    category: "listings",
    description: "What this organisation is promoting now: the pinned item, else the newest published one.",
    memberSafe: true,
    styling: "tailwind",
    dataDriven: true,
    props,
  },
  AcOffering,
  () => ({
    heading: "Now",
    showImage: true,
    showExcerpt: true,
    buttonLabel: "Read more",
    emptyMessage: "Nothing on offer just now. Check back soon.",
    offering: {
      id: "sample",
      title: "An evening of new work",
      kind: "event",
      href: "#",
      excerpt: "A first look at what the group has been making this season.",
      scheduledAt: null,
      location: "The studio",
      price: null,
      currency: null,
      coverImageUrl: null,
      pinned: true,
    },
  })
);
