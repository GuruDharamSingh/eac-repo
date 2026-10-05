import { defineBlock, RichText, type PropsOf } from "@elkdonis/blocks";
import { BookingView } from "./booking.client";
import { SAMPLE_BOOKING, SAMPLE_SERVICES, type WireBooking, type WireService } from "./service-sample";

// ============================================================================
// The services blocks.
//
//   pt-services   a list of the site's services as cards or rows
//   pt-service    one service in full: picture, price, facts, description
//   pt-booking    card booking (or an enquiry) for the chosen service
//
// "The chosen service" is the block's own `service` field, else `?service=<slug>`
// on the page, else the newest. The cards in `pt-services` link to
// `?service=<slug>#book`, so one page can list, describe and book.
//
// Rows come from resolvers (lib/puck/data-service.ts). pt-service and
// pt-services are plain server-safe components; pt-booking runs in the browser
// (booking.client.tsx).
// ============================================================================

const BOOKING_LABEL: Record<string, string> = {
  one_on_one: "One to one",
  group: "Group",
  async: "At your own pace",
};
const FORMAT_LABEL: Record<string, string> = { in_person: "In person", online: "Online", hybrid: "In person and online" };

function facts(s: WireService): string[] {
  const out: string[] = [];
  if (s.bookingType) out.push(BOOKING_LABEL[s.bookingType] ?? s.bookingType);
  if (s.format) out.push(FORMAT_LABEL[s.format] ?? s.format);
  if (s.sessionCount && s.sessionCount > 1) out.push(`${s.sessionCount} sessions`);
  if (s.sessionDurationHrs) out.push(`${s.sessionDurationHrs} h each`);
  if (s.recurrenceLabel) out.push(s.recurrenceLabel);
  if (s.location) out.push(s.location);
  return out;
}

// ── list ────────────────────────────────────────────────────────────────────

const listProps = [
  { name: "heading", kind: "string", label: "Heading", default: "Services" },
  { name: "intro", kind: "text", label: "Line under the heading", default: "" },
  { name: "limit", kind: "number", label: "How many", default: 12, min: 1, max: 24, step: 1 },
  {
    name: "layout",
    kind: "select",
    label: "Look",
    default: "cards",
    options: [
      { value: "cards", label: "Cards" },
      { value: "rows", label: "Rows" },
    ],
  },
  { name: "showImages", kind: "boolean", label: "Pictures", default: true },
  { name: "chooseLabel", kind: "string", label: "Button says", default: "Choose" },
  { name: "emptyMessage", kind: "string", label: "When there are none", default: "Nothing is offered right now." },
] as const;

export function ServicesList({
  services = [],
  heading = "Services",
  intro = "",
  layout = "cards",
  showImages = true,
  chooseLabel = "Choose",
  emptyMessage = "Nothing is offered right now.",
}: PropsOf<typeof listProps> & { services?: WireService[] }) {
  return (
    <section>
      {heading ? <h2 className="font-serif text-2xl">{heading}</h2> : null}
      {intro ? <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{intro}</p> : null}
      {heading || intro ? <hr className="saffron-divider max-w-[12rem]" /> : null}

      {services.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : layout === "rows" ? (
        <ul className="divide-y divide-border/70 border-y border-border/70">
          {services.map((s) => (
            <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-3 py-4">
              <div className="min-w-0">
                <h3 className="font-serif text-lg">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{facts(s).join(" · ")}</p>
              </div>
              <div className="flex items-baseline gap-4">
                {s.priceLabel ? <span className="font-serif text-lg">{s.priceLabel}</span> : null}
                <a href={`?service=${encodeURIComponent(s.slug)}#book`} className="text-sm underline underline-offset-4">
                  {chooseLabel}
                </a>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {services.map((s) => (
            <article key={s.id} className="card-natural flex flex-col overflow-hidden">
              {showImages && s.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.coverImageUrl} alt="" className="aspect-[16/9] w-full object-cover" />
              ) : null}
              <div className="flex flex-1 flex-col p-6">
                <p className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--primary))]">
                  {facts(s).slice(0, 2).join(" · ")}
                </p>
                <h3 className="mt-2 font-serif text-xl">{s.title}</h3>
                {s.subtitle ? <p className="mt-1 text-sm italic text-muted-foreground">{s.subtitle}</p> : null}
                {s.summary ? <p className="mt-3 text-sm leading-relaxed">{s.summary}</p> : null}
                <div className="mt-auto flex items-center justify-between pt-5">
                  <span className="font-serif text-lg">{s.priceLabel ?? ""}</span>
                  <a
                    href={`?service=${encodeURIComponent(s.slug)}#book`}
                    className="border border-[hsl(var(--primary))]/50 bg-[hsl(var(--primary))]/15 px-4 py-2 text-sm font-medium text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/25"
                  >
                    {chooseLabel}
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export const servicesList = defineBlock(
  {
    id: "pt-services",
    category: "listings",
    label: "Services list",
    description: "The site's services as cards or rows, each with its price and a button that selects it for booking.",
    memberSafe: true,
    dataDriven: true,
    styling: "tailwind",
    props: listProps,
  },
  ServicesList,
  () => ({ heading: "Services", limit: 12, layout: "cards" as const, showImages: true, services: SAMPLE_SERVICES })
);

// ── one service ─────────────────────────────────────────────────────────────

const serviceProps = [
  {
    name: "service",
    kind: "string",
    binds: "service",
    label: "Service",
    description: "Empty shows the one the visitor chose (?service=…), else the newest.",
    default: "",
  },
  { name: "showImage", kind: "boolean", label: "Picture", default: true },
  { name: "showBody", kind: "boolean", label: "Full description", default: true },
] as const;

export function ServiceDetail({
  chosen: service,
  showImage = true,
  showBody = true,
}: PropsOf<typeof serviceProps> & { chosen?: WireService | null }) {
  if (!service) return <p className="card-natural p-6 text-sm text-muted-foreground">No service to show yet.</p>;
  return (
    <article className="card-natural overflow-hidden">
      {showImage && service.coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={service.coverImageUrl} alt="" className="aspect-[16/9] w-full object-cover" />
      ) : null}
      <div className="p-6">
        <p className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--primary))]">{facts(service).join(" · ")}</p>
        <h2 className="mt-2 font-serif text-3xl">{service.title}</h2>
        {service.subtitle ? <p className="mt-1 italic text-muted-foreground">{service.subtitle}</p> : null}
        {service.priceLabel ? (
          <p className="mt-4 font-serif text-2xl">
            {service.priceLabel}
            {service.slidingScaleNote ? (
              <span className="ml-3 font-sans text-sm text-muted-foreground">{service.slidingScaleNote}</span>
            ) : null}
          </p>
        ) : null}
        {service.summary ? <p className="mt-4 leading-relaxed">{service.summary}</p> : null}
        {showBody && service.bodyHtml ? (
          <RichText body={service.bodyHtml} className="mt-4 leading-relaxed [&_p]:mb-3" />
        ) : null}
      </div>
    </article>
  );
}

export const serviceDetail = defineBlock(
  {
    id: "pt-service",
    category: "content",
    label: "Service (one in full)",
    description: "One service: picture, kind, price, sessions and its description.",
    memberSafe: true,
    dataDriven: true,
    styling: "tailwind",
    props: serviceProps,
  },
  ServiceDetail,
  () => ({ showImage: true, showBody: true, chosen: SAMPLE_SERVICES[0] })
);

// ── booking ─────────────────────────────────────────────────────────────────

const bookingProps = [
  {
    name: "service",
    kind: "string",
    binds: "service",
    label: "Service",
    description: "Empty books the one the visitor chose (?service=…), else the newest.",
    default: "",
  },
  { name: "heading", kind: "string", label: "Heading", default: "Book" },
  {
    name: "notesLabel",
    kind: "string",
    label: "Label over the note box",
    default: "Anything we should know before you come? (optional)",
  },
] as const;

export const booking = defineBlock(
  {
    id: "pt-booking",
    category: "actions",
    label: "Book this service",
    description:
      "Pay by card to book a group or self-paced service. One-to-one services, or a site whose payouts are not set up yet, show an enquiry form instead.",
    // Editors only reach the page editor; `memberSafe: false` would also lock
    // the block out of the drawer for them.
    memberSafe: true,
    interactive: true,
    dataDriven: true,
    styling: "tailwind",
    props: bookingProps,
  },
  BookingView as unknown as React.ComponentType<PropsOf<typeof bookingProps> & { booking?: WireBooking | null }>,
  () => ({ heading: "Book", booking: SAMPLE_BOOKING })
);
