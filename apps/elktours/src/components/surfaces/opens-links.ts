import type { SurfaceDescriptor } from "@elkdonis/cms-ui/surface";

// The click binding for links a block drew for "Opens" (2026-11-06; split out 2026-11-07). Free of @elkdonis/blocks:
// it is in the root layout's bundle, so every page loads it.

/**
 * Clicks on a link a block drew for "Opens" (`a[data-opens]`): the popup opens over the page instead of following
 * the link, which still goes to the record's own page with a modifier key, a middle click, or no scripts at all.
 * The popup kinds are the ones this site registers (HubSurfaces `custom`); anything else follows the link.
 */
export function bindOpensLinks(open: (d: SurfaceDescriptor) => void, keys: ReadonlySet<string>): () => void {
  const onClick = (ev: MouseEvent) => {
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    const a = (ev.target as Element | null)?.closest?.("a[data-opens]") as HTMLAnchorElement | null;
    // The editors draw the page too; a click there selects, it does not open.
    if (!a || a.closest("[data-tree-node], [data-puck-component], .de-popup")) return;
    let d: { key?: unknown; title?: unknown; kind?: unknown; size?: unknown; props?: unknown } | null = null;
    try { d = JSON.parse(a.dataset.opens ?? "null"); } catch { d = null; }
    if (!d || typeof d.key !== "string" || !keys.has(d.key)) return;
    ev.preventDefault();
    open({
      type: "custom",
      key: d.key,
      ...(typeof d.title === "string" ? { title: d.title } : {}),
      ...(typeof d.kind === "string" ? { kind: d.kind as never } : {}),
      ...(typeof d.size === "string" ? { size: d.size as never } : {}),
      props: d.props && typeof d.props === "object" ? (d.props as Record<string, unknown>) : {},
    });
  };
  document.addEventListener("click", onClick);
  return () => document.removeEventListener("click", onClick);
}
