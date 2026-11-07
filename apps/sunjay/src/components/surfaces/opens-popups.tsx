"use client";

import { SurfaceFrame, type SurfaceAction, type SurfaceDescriptor } from "@elkdonis/cms-ui/surface";
import { FeaturedPerson, type FeaturedWho } from "@elkdonis/blocks";

// ============================================================================
// "Opens" on Para Theater (2026-11-07, as on elktours 2026-11-06): the person popup, which may end in one onward step
// ("Then"), a button to a page. Loaded only when it opens (HubSurfaces imports it through next/dynamic): it draws
// FeaturedPerson from @elkdonis/blocks, whose main entry is the whole catalogue, about 120 KB of script measured on
// every page when this file sat in the root layout's bundle. The click binding is ./opens-links.ts. Props come from the server
// (lib/opens-server.ts `resolveOpens`), read under the public rules, so nothing here fetches a record by a caller's id.
// ============================================================================

type Custom = Extract<SurfaceDescriptor, { type: "custom" }>;
type Then = { href: string; label: string } | null;

const thenOf = (v: unknown): Then => {
  const t = v as { href?: unknown; label?: unknown } | null;
  return t && typeof t.href === "string" && /^\/(?!\/)/.test(t.href) && typeof t.label === "string" ? { href: t.href, label: t.label } : null;
};

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
            <div style={{ marginTop: "0.75rem", fontSize: "0.9rem", display: "grid", gap: "0.5rem" }}>{who.bio.split(/\n{2,}/).slice(1).map((p, i) => <p key={i} style={{ margin: 0 }}>{p}</p>)}</div>
          )}
        </div>
      ) : (
        <p style={{ fontSize: "0.9rem", color: "var(--sf-muted)" }}>This person is not shown here.</p>
      )}
    </SurfaceFrame>
  );
}
