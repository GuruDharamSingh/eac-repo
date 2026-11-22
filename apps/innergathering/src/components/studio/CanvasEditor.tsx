"use client";

import { useRouter } from "next/navigation";
import type { PuckDoc } from "@elkdonis/direct-edit/block";
import { HouseEditor } from "@elkdonis/house-editor";
import { savePageAction } from "@/lib/puck/actions";

// The canvas page editor: the house canvas (@elkdonis/house-editor) bound to this site's catalogue and save
// action. Saves are guarded by the page's version (loadPageWithVersion on the route).

/** Props each data block's resolver fills (fetched rows are drawn, never saved). Only the thread feed resolves here. */
const KEYS: Record<string, readonly string[]> = { "thread-feed": ["items"] };

/** The catalogue and picture chooser load on opening. No editor-shape config: this canvas has no "Settings…" (Puck is at /studio/<slug>). */
const load = async () => {
  const [{ canvasConfig }, { choosePicture }] = await Promise.all([
    import("@/lib/puck/config.client"),
    import("@/components/landing/page-picture-chooser"),
  ]);
  return { canvasConfig, choosePicture };
};

export function CanvasEditor({ slug, orgId, initial, version }: { slug: string; orgId: string; initial: PuckDoc; version?: string }) {
  const router = useRouter();
  return (
    <HouseEditor
      slug={slug}
      orgId={orgId}
      initial={initial}
      version={version}
      config={load}
      save={savePageAction}
      resolvedKeys={KEYS}
      routes={{ blocks: `/studio/${slug}`, done: "/studio" }}
      navigate={(href) => router.push(href)}
      // As before: no design tools, no inception.
      flags={{ designTools: false, inception: false }}
      hostStyle={{ minHeight: "100vh", paddingTop: 44 }}
    />
  );
}
