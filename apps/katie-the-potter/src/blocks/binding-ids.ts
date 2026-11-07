// Client-safe: shared by the editor's resolvers (browser) and the published
// page's (server), so it must not live beside the database code.

/** Every artwork id a block's props bind to, wherever the binding sits. */
export function boundIds(props: Record<string, unknown>): string[] {
  const out: string[] = [];
  if (typeof props.artwork === "string" && props.artwork) out.push(props.artwork);
  const rows = props.chosen;
  if (Array.isArray(rows)) {
    for (const row of rows) {
      const id = (row as { artwork?: unknown } | null)?.artwork;
      if (typeof id === "string" && id) out.push(id);
    }
  }
  return out;
}
