"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { SurfaceFrame, useSurface, type SurfaceDescriptor } from "@elkdonis/cms-ui/surface";

// ============================================================================
// The `enneagram-type` surface (round 3): a type's chapter as a popup,
// registered under `connectors.custom` in components/hub/HubSurfaces.tsx.
//
// Its twin is the chapter row on /enneagram (`#type-N`, blocks/type-chapter):
// the popup draws what that row holds, read from the page, so a chapter
// edited in the studio reads the same in both. Opened anywhere without that
// row (another page), it falls back to the code copy (lib/exposition.ts),
// loaded only then. Custom surfaces do not deep-link through `?surface=`;
// the address for a type is `/enneagram#type-N`.
// ============================================================================

type Chapter = { name: string; epithets: string; html: string; pageLabel?: string };

export function typeDescriptor(n: number): Extract<SurfaceDescriptor, { type: "custom" }> {
  return { type: "custom", key: "enneagram-type", title: `Type ${n}`, size: "standard", props: { n } };
}

function fromPage(n: number): Chapter | null {
  const row = document.querySelector<HTMLElement>(`[data-he-type-chapter="${n}"]`);
  if (!row) return null;
  return {
    name: row.querySelector(".he-type-name")?.textContent ?? `Type ${n}`,
    epithets: row.querySelector(".he-type-epithets")?.textContent ?? "",
    html: row.querySelector(".he-type-text")?.innerHTML ?? "",
    pageLabel: row.dataset.pageLabel,
  };
}

const CENTER = (n: number) => (n === 8 || n === 9 || n === 1 ? "gut" : n <= 4 ? "heart" : "head");

export function TypeSurface({ descriptor }: { descriptor: Extract<SurfaceDescriptor, { type: "custom" }> }) {
  const n = Math.min(9, Math.max(1, Number(descriptor.props?.n) || 1));
  const surface = useSurface();
  const [chapter, setChapter] = useState<Chapter | null>(() => (typeof document === "undefined" ? null : fromPage(n)));

  useEffect(() => {
    const here = fromPage(n);
    if (here) {
      setChapter(here);
      return;
    }
    let live = true;
    import("@/lib/exposition").then(({ TYPE_CHAPTERS }) => {
      const c = TYPE_CHAPTERS.find((t) => t.n === n);
      if (live && c) setChapter({ name: c.name, epithets: c.epithets, html: c.lead + c.body });
    });
    return () => {
      live = false;
    };
  }, [n]);

  const prev = n === 1 ? 9 : n - 1;
  const next = n === 9 ? 1 : n + 1;
  const onPage = typeof window !== "undefined" && window.location.pathname === "/enneagram";

  return (
    <SurfaceFrame
      kind="neutral"
      kicker={`Type ${n}`}
      title={chapter?.name ?? `Type ${n}`}
      actions={[
        { label: `← ${prev}`, quiet: true, onClick: () => surface.replace(typeDescriptor(prev)) },
        { label: `${next} →`, quiet: true, onClick: () => surface.replace(typeDescriptor(next)) },
        onPage
          ? {
              label: chapter?.pageLabel || "In the page",
              primary: true,
              onClick: () => {
                surface.close();
                // After the dialog lets go of the page, so the row can take focus and scroll.
                window.setTimeout(() => {
                  if (window.location.hash === `#type-${n}`) window.dispatchEvent(new HashChangeEvent("hashchange"));
                  else window.location.hash = `type-${n}`;
                }, 0);
              },
            }
          : { label: chapter?.pageLabel || "In the page", primary: true, href: `/enneagram#type-${n}` },
      ]}
    >
      <div className="he-type-pop" data-he-plain="" style={{ "--type-hue": `var(--he-${CENTER(n)})` } as CSSProperties}>
        {chapter?.epithets ? <p className="he-type-pop-epithets">{chapter.epithets}</p> : null}
        {chapter ? (
          // The row's own server-rendered (sanitised) text, or the code copy.
          <div className="he-type-text" dangerouslySetInnerHTML={{ __html: chapter.html }} />
        ) : (
          <p className="he-type-pop-epithets">…</p>
        )}
      </div>
    </SurfaceFrame>
  );
}
