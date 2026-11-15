import { cache } from "react";
import type { CheckoutView, RecordView } from "@elkdonis/blocks";
import { loadPostBlock, loadServiceBlock, serviceView } from "@/lib/record-blocks";

// ============================================================================
// This site's records for the shared record blocks (record-header, record-body,
// record-facts, checkout; packages/blocks/src/blocks/record-parts.tsx), server
// only (2026-11-11). The published page calls this from lib/puck/config.server.ts;
// the editor reaches it through /api/blocks/he-records?block=record.
//
// A reference is "service:<slug>" or "post:<feed>/<slug>". It comes from the
// route (`routeRecord`, injected at render, never stored) or from the block's
// own `record` setting; with neither, the editor's sample is the first
// service. Every read goes through lib/record-blocks.ts, which reads this
// site's organisation only and applies the viewer rules, so a reference to
// another organisation's record resolves to nothing.
//
// The words here are this site's (what he-service kept as fourteen settings):
// they belong to the host, not to a page.
// ============================================================================

const SERVICE = /^service:([a-z0-9][a-z0-9-]{0,99})$/;
const POST = /^post:([a-z0-9][a-z0-9-]{0,63})\/([^\s/]{1,200})$/;

const CARD_MESSAGE: Record<string, string> = {
  amount: "Choose an amount inside the sliding scale.",
  refused: "The card page could not be opened for this booking. Please try again, or get in touch.",
  failed: "We could not start the payment. Please try again.",
};

const day = (iso: string) =>
  new Date(iso).toLocaleString("en-CA", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Toronto" });

export interface RecordParts {
  rec: RecordView | null;
  pay: CheckoutView | null;
  /** The reference the checkout's action is bound to; null when nothing here is sold. */
  recordRef: string | null;
}

const NOTHING: RecordParts = { rec: null, pay: null, recordRef: null };

type Props = { record?: unknown; routeRecord?: unknown; routeQuery?: unknown };

/** One read of a service per request, however many record blocks the page has. */
const readService = cache((slug: string | null) => serviceView(slug));

function serviceRecord(view: NonNullable<Awaited<ReturnType<typeof serviceView>>>): RecordView {
  return {
    kind: "service",
    kicker: (view.bookingType ?? "one_on_one") === "one_on_one" ? "A reading" : "An offering",
    title: view.title,
    subtitle: view.subtitle,
    coverUrl: view.bannerUrl,
    bodyHtml: view.bodyHtml,
    facts: view.facts,
  };
}

/**
 * What the record blocks draw. `pay: true` also reads where the booking stands
 * (the checkout block only: it may reconcile an order with Stripe after a
 * return). `visitor` = the editor's sample, as a signed-out visitor sees it.
 */
export async function loadRecordParts(props: Props, { pay = false, visitor = false }: { pay?: boolean; visitor?: boolean } = {}): Promise<RecordParts> {
  try {
    const ref = (typeof props.routeRecord === "string" && props.routeRecord) || (typeof props.record === "string" ? props.record.trim() : "");
    const post = POST.exec(ref);
    if (post) {
      const { post: p } = await loadPostBlock({ routeFeed: post[1], routeSlug: post[2] }, { visitor });
      if (!p) return NOTHING;
      return {
        rec: {
          kind: p.kind,
          kicker: p.feedName,
          title: p.title,
          subtitle: p.excerpt,
          dateLabel: day(p.publishedAt),
          authorName: p.authorName,
          authorHref: p.authorSlug ? `/about/${p.authorSlug}` : null,
          coverUrl: p.coverImageUrl,
          bodyHtml: p.bodyHtml,
        },
        pay: null,
        recordRef: null,
      };
    }

    const svc = SERVICE.exec(ref);
    // A reference that is neither shape draws nothing; an empty one is the editor's sample.
    if (ref && !svc) return NOTHING;
    const slug = svc ? svc[1] : null;
    if (!pay) {
      const view = await readService(slug);
      return view ? { rec: serviceRecord(view), pay: null, recordRef: `service:${view.slug}` } : NOTHING;
    }

    const { service, booking } = await loadServiceBlock({ routeSlug: slug ?? "", routeQuery: visitor ? {} : props.routeQuery });
    if (!service) return NOTHING;
    const oneOnOne = (service.bookingType ?? "one_on_one") === "one_on_one";
    const b = booking;
    const paid = b?.booked
      ? [
          "Thank you — your booking is paid.",
          !oneOnOne || b.after === "open"
            ? ""
            : b.after === "sent"
              ? "Your times have been sent. You will hear back by email with one confirmed, or others offered."
              : "The email we sent you has a link to suggest times and follow the booking.",
        ]
          .filter(Boolean)
          .join(" ")
      : null;
    return {
      rec: {
        kind: "service",
        kicker: oneOnOne ? "A reading" : "An offering",
        title: service.title,
        subtitle: service.subtitle,
        coverUrl: service.bannerUrl,
        bodyHtml: service.bodyHtml,
        facts: service.facts,
      },
      recordRef: `service:${service.slug}`,
      pay: {
        price: service.price,
        priceMin: service.priceSlidingMin,
        currency: service.currency,
        rangeNote: service.slidingScaleNote,
        open: service.registrationStatus === "open" && service.price != null,
        unavailable: b?.unavailable ?? null,
        alert: b?.card ? (CARD_MESSAGE[b.card] ?? CARD_MESSAGE.failed) : b?.cancelled ? "Payment was cancelled; nothing was charged." : null,
        note: "You pay on Stripe’s secure page, then suggest times that suit you.",
        paidLine: paid,
        // "When would suit you?" (blocks/record-site.tsx): only for a paid one-to-one whose times are still to send.
        after: b?.booked && oneOnOne && b.after === "open" && b.orderId ? { slug: service.slug, orderId: b.orderId } : null,
      },
    };
  } catch (err) {
    console.error("[hidden-enneagram] loadRecordParts:", err);
    return NOTHING;
  }
}
