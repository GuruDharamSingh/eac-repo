"use client";

import { SurfaceFrame, type SurfaceAction, type SurfaceDescriptor } from "@elkdonis/cms-ui/surface";
import { FeaturedPerson, type FeaturedWho } from "@elkdonis/blocks";
import { ReviewsSection } from "@/components/reviews/reviews-section";
import type { ReviewTargetType } from "@/lib/catalogue-types";

// ============================================================================
// The two popups "Opens" added (2026-11-06, docs/open/COMPONENT_CONNECTIONS_2026-11-06.md): reviews of a tour, an
// experience or a place, and a person. Loaded only when one opens (HubSurfaces uses next/dynamic, 2026-11-07): this
// file imports @elkdonis/blocks, whose main entry is the whole catalogue (about 120 KB of script measured on every
// Para Theater page while its copy of this file sat in the root layout's bundle). The click binding is ./opens-links.ts. Each may end in one onward step, "Then", a button to a page. Their props
// come from the server (lib/opens-server.ts `resolveOpens`), which read the record under the public rules, so
// nothing here fetches a record by a caller's id except the reviews, through the reviews' own public action.
// ============================================================================

type Custom = Extract<SurfaceDescriptor, { type: "custom" }>;
type Then = { href: string; label: string } | null;

const thenOf = (v: unknown): Then => {
  const t = v as { href?: unknown; label?: unknown } | null;
  return t && typeof t.href === "string" && /^\/(?!\/)/.test(t.href) && typeof t.label === "string" ? { href: t.href, label: t.label } : null;
};
const TARGETS: ReadonlySet<string> = new Set(["tour", "experience", "place"]);

export function ReviewsPopup({ descriptor }: { descriptor: Custom }) {
  const type = String(descriptor.props?.type ?? "");
  const id = typeof descriptor.props?.id === "string" ? descriptor.props.id : "";
  const then = thenOf(descriptor.props?.then);
  const actions: SurfaceAction[] = then ? [{ label: then.label, href: then.href, primary: true }] : [];
  return (
    <SurfaceFrame kind="post" kicker="Reviews" title={descriptor.title ?? "Reviews"} actions={actions}>
      {TARGETS.has(type) && id ? (
        <div data-opens-popup="reviews">
          <ReviewsSection target={{ type: type as ReviewTargetType, id }} title="What visitors say" compact />
        </div>
      ) : (
        <p className="text-sm text-[color:var(--sf-muted)]">These reviews could not be found.</p>
      )}
    </SurfaceFrame>
  );
}

export function PersonPopup({ descriptor }: { descriptor: Custom }) {
  const who = (descriptor.props?.who ?? null) as FeaturedWho | null;
  const then = thenOf(descriptor.props?.then);
  const actions: SurfaceAction[] = then ? [{ label: then.label, href: then.href, primary: true }] : who?.href ? [{ label: "Their page", href: who.href }] : [];
  return (
    <SurfaceFrame kind="post" kicker="Person" title={descriptor.title ?? who?.displayName ?? "Person"} actions={actions}>
      {who ? (
        <div data-opens-popup="person">
          {/* The person's link is the popup's own button; inside the card the name stays plain. */}
          <FeaturedPerson person="" layout="side" who={{ ...who, href: null }} showVia={false} />
          {who.bio && who.bio.split(/\n{2,}/).length > 1 && (
            <div className="mt-3 space-y-2 text-sm">{who.bio.split(/\n{2,}/).slice(1).map((p, i) => <p key={i}>{p}</p>)}</div>
          )}
        </div>
      ) : (
        <p className="text-sm text-[color:var(--sf-muted)]">This person is not shown here.</p>
      )}
    </SurfaceFrame>
  );
}
