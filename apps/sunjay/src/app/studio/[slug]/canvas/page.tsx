import { redirect } from "next/navigation";

/**
 * The canvas editor's old address. Since 2026-11-14 the canvas is /studio/<slug>
 * itself (canvas first); links saved before then, and "Edit this page" on a
 * published page (lib/puck/render.tsx), come through here.
 */
export const dynamic = "force-dynamic";

export default async function OldCanvasPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) for (const one of Array.isArray(v) ? v : v === undefined ? [] : [v]) q.append(k, one);
  const tail = q.toString();
  redirect(`/studio/${encodeURIComponent(slug)}${tail ? `?${tail}` : ""}`);
}
