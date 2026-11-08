import type { Data } from "@puckeditor/core";

type Node = { type?: string; props?: Record<string, unknown> };

function inject(nodes: unknown, type: string, route: Record<string, unknown>): unknown {
  if (!Array.isArray(nodes)) return nodes;
  return nodes.map((n: Node) => {
    if (!n || typeof n !== "object" || !n.props) return n;
    const props: Record<string, unknown> = { ...n.props };
    for (const [k, v] of Object.entries(props)) if (Array.isArray(v)) props[k] = inject(v, type, route);
    if (n.type === type) Object.assign(props, route);
    return { ...n, props };
  });
}

/**
 * Round 6: hand a template's address to every `type` block in it, slots
 * included, before the page resolves (app/services/[slug]/page.tsx's
 * withRoute, for the article and person templates). The keys are listed in
 * RESOLVED_KEYS, so a save can never store them.
 */
export function withRouteProps(data: Data, type: string, route: Record<string, unknown>): Data {
  return { ...data, content: inject(data.content, type, route) } as Data;
}
