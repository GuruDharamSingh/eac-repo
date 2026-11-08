import { defineBlock, RichText, type PropsOf } from "@elkdonis/blocks";
import { editingOf, type PuckEditing } from "@elkdonis/blocks/record";
import { WhenForm } from "@/components/booking/when-form";
import { bookAndPay, saveBookingTimes } from "@/lib/booking-actions";

// ============================================================================
// A service and "Book and pay" (he-service, round 3, 2026-11-07). The page
// `/services/<slug>` is the studio page `service` (one template for every
// service); this block draws the service named in the address, the record's
// own text from data, and every word around it from its props, so Ario edits
// the framing in the studio and the service in /manage.
//
// The route injects `routeSlug` and `routeQuery` before resolving
// (app/services/[slug]/page.tsx); the server resolver (lib/service-block.ts)
// reads the service, whether card booking is open, and, after payment, the
// order's state. In the editor the resolver draws the first service as a
// sample, and nothing in the block acts (a click selects it).
//
// Book and pay goes straight to Stripe (katie's Buy now: lib/booking-actions
// bookAndPay); Stripe returns to `?booked=1&order=<id>`, where a one-to-one
// service asks "When would suit you?" (saveBookingTimes).
// ============================================================================

export interface ServiceView {
  slug: string;
  title: string;
  subtitle: string | null;
  bodyHtml: string | null;
  bookingType: string | null;
  facts: { label: string; value: string }[];
  price: number | null;
  priceSlidingMin: number | null;
  slidingScaleNote: string | null;
  currency: string;
  registrationStatus: string;
  bannerUrl: string | null;
}

export interface ServiceBookingState {
  booked: boolean;
  /** Set after payment when the times can still be suggested. */
  orderId: string | null;
  after: "open" | "sent" | "none" | null;
  /** Why card booking is closed, as a sentence; null = open. */
  unavailable: string | null;
  card: string | null;
  cancelled: boolean;
}

const props = [
  { name: "serviceSlug", kind: "string", label: "Service", description: "Empty = the service in the address (the usual case).", default: "" },
  { name: "backLabel", kind: "string", label: "Back link", default: "← Readings" },
  { name: "backHref", kind: "url", label: "Back link goes to", default: "/readings" },
  { name: "eyebrowOne", kind: "string", label: "Eyebrow (one-to-one)", default: "A reading", inlineEditable: true },
  { name: "eyebrowOther", kind: "string", label: "Eyebrow (other kinds)", default: "An offering" },
  { name: "bookLabel", kind: "string", label: "Button", default: "Book and pay", inlineEditable: true },
  { name: "amountLabel", kind: "string", label: "Sliding scale: amount field", default: "What you will pay" },
  { name: "payNote", kind: "string", label: "Under the button", default: "You pay on Stripe’s secure page, then suggest times that suit you." },
  { name: "paidLine", kind: "string", label: "After payment", default: "Thank you — your booking is paid." },
  { name: "whenIntro", kind: "richtext", label: "After payment: above the times", default: "" },
  { name: "sentLine", kind: "string", label: "After the times are sent", default: "Your times have been sent. You will hear back by email with one confirmed, or others offered." },
  { name: "emailLine", kind: "string", label: "After payment, when times can't be asked here", default: "The email we sent you has a link to suggest times and follow the booking." },
  { name: "cancelledLine", kind: "string", label: "Payment cancelled", default: "Payment was cancelled; nothing was charged." },
  { name: "closedLine", kind: "string", label: "Not open for booking", default: "Not open for booking at the moment." },
] as const;

type Props = PropsOf<typeof props> & {
  service?: ServiceView | null;
  booking?: ServiceBookingState | null;
  puck?: PuckEditing;
};

const CARD_MESSAGE: Record<string, string> = {
  amount: "Choose an amount inside the sliding scale.",
  refused: "The card page could not be opened for this booking. Please try again, or get in touch.",
  failed: "We could not start the payment. Please try again.",
};

const money = (n: number, currency: string) => new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(n);
const s = (v: unknown) => (typeof v === "string" ? v : "");

export function HeService(p: Props) {
  const { drawn } = editingOf(p.puck);
  const svc = p.service ?? null;
  const b = p.booking ?? null;
  if (!svc) {
    return (
      <section className="blk he-svc">
        <p className="he-svc-note">{drawn ? "No published service to show yet." : s(p.closedLine)}</p>
      </section>
    );
  }
  const oneOnOne = (svc.bookingType ?? "one_on_one") === "one_on_one";
  const sliding = svc.price != null && svc.priceSlidingMin != null && svc.priceSlidingMin < svc.price;
  const open = svc.registrationStatus === "open" && svc.price != null;
  const cardMessage = b?.card ? CARD_MESSAGE[b.card] ?? b.unavailable ?? CARD_MESSAGE.failed : null;

  const booking = b?.booked ? (
    <>
      <p role="status" className="he-svc-paid">
        {p.paidLine}
      </p>
      {oneOnOne && b.after === "open" && b.orderId ? (
        <>
          {s(p.whenIntro).trim() ? <RichText className="he-svc-note" body={p.whenIntro} /> : null}
          <WhenForm action={saveBookingTimes.bind(null, svc.slug, b.orderId)} />
        </>
      ) : oneOnOne ? (
        <p className="he-svc-note">{b.after === "sent" ? p.sentLine : p.emailLine}</p>
      ) : null}
    </>
  ) : open ? (
    <form action={bookAndPay.bind(null, svc.slug)} className="he-svc-pay">
      <p className="he-svc-price">
        {sliding ? `${money(svc.priceSlidingMin!, svc.currency)} – ${money(svc.price!, svc.currency)}` : money(svc.price!, svc.currency)}
      </p>
      {sliding ? (
        <label className="he-svc-amount">
          <span>
            {p.amountLabel} ({svc.currency})
          </span>
          <input type="number" name="amount" className="he-input" min={svc.priceSlidingMin!} max={svc.price!} step="1" defaultValue={svc.price!} required />
          {svc.slidingScaleNote ? <span className="he-svc-note">{svc.slidingScaleNote}</span> : null}
        </label>
      ) : null}
      {cardMessage ? (
        <p role="alert" className="he-svc-alert">
          {cardMessage}
        </p>
      ) : b?.cancelled ? (
        <p role="status" className="he-svc-note">
          {p.cancelledLine}
        </p>
      ) : null}
      {b?.unavailable ? (
        <p className="he-svc-note">{b.unavailable}</p>
      ) : (
        <button type="submit" className="he-btn he-primary he-svc-cta" data-book-and-pay="">
          {p.bookLabel || "Book and pay"}
        </button>
      )}
      {p.payNote ? <p className="he-svc-small">{p.payNote}</p> : null}
    </form>
  ) : (
    <p className="he-svc-note">{p.closedLine}</p>
  );

  return (
    <article className="blk he-svc">
      {s(p.backLabel).trim() ? (
        <a href={s(p.backHref) || "/readings"} className="he-svc-back">
          {p.backLabel}
        </a>
      ) : null}
      <header className="he-svc-head">
        <p className="he-eyebrow">{oneOnOne ? p.eyebrowOne : p.eyebrowOther}</p>
        <h1 className="he-svc-title">{svc.title}</h1>
        {svc.subtitle ? <p className="he-svc-sub">{svc.subtitle}</p> : null}
      </header>
      {svc.bannerUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={svc.bannerUrl} alt="" className="he-svc-banner" />
      ) : (
        <div className="he-orb" data-size="small" aria-hidden="true" />
      )}
      {svc.facts.length ? (
        <dl className="he-svc-facts">
          {svc.facts.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {/* Sanitised by the resolver (sanitizeRichText); the record's own text. */}
      {svc.bodyHtml ? <div className="he-svc-body" dangerouslySetInnerHTML={{ __html: svc.bodyHtml }} /> : null}
      <section className="he-svc-book" aria-label="Booking" id="book">
        {drawn ? <div inert>{booking}</div> : booking}
      </section>
    </article>
  );
}

export const heService = defineBlock(
  {
    id: "he-service",
    label: "Service and Book and pay",
    category: "actions",
    description: "The service in the address (its own text from /manage), with Book and pay straight to Stripe. The words around it are yours.",
    memberSafe: true,
    styling: "tokens",
    props,
    parts: {
      root: { label: "Service", sel: "> .he-svc" },
      head: { label: "Title", sel: "> .he-svc .he-svc-head" },
      facts: { label: "Facts", sel: "> .he-svc .he-svc-facts" },
      body: { label: "Text", sel: "> .he-svc .he-svc-body" },
      book: { label: "Booking box", sel: "> .he-svc .he-svc-book" },
      button: { label: "Button", sel: "> .he-svc .he-svc-cta", prop: "bookLabel" },
    },
    tokens: [
      { name: "--he-aurum", label: "Accent (button)", type: "color" },
      { name: "--he-card", label: "Booking box", type: "color" },
    ],
  },
  HeService,
);
