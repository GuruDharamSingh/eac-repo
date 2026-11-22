"use client";

import { useRouter } from "next/navigation";
import type { PuckDoc } from "@elkdonis/direct-edit/block";
import { HouseEditor } from "@elkdonis/house-editor";
import { RESOLVED_KEYS } from "@/lib/puck/resolved";
import { listEditablePagesAction, savePageAction } from "@/lib/puck/actions";

// The page editor at /studio/<slug>, canvas first (2026-11-20, as sunjay): the house canvas
// (@elkdonis/house-editor) bound to this site's catalogue, save action and routes. Saves are guarded by the
// page's version (loadPageWithVersion on the route): an editor open in another tab cannot be overwritten, and a
// refused save leaves the canvas dirty with the user's edits in it. Puck's editor on the whole page is /studio/<slug>/blocks.

/** The catalogue, picture chooser and record sources load on opening: a visitor's page references none of them. */
const load = async () => {
  const [{ canvasConfig, canvasContract, puckConfig }, { choosePicture }, { records }] = await Promise.all([
    import("@/lib/puck/config.client"),
    import("@/components/landing/page-picture-chooser"),
    import("@/components/landing/person-records"),
  ]);
  return { canvasConfig, puckConfig, contract: canvasContract, choosePicture, records };
};

/** The page switcher in the name pill: this site's saved pages, never the landing page or a phone layout. */
const pages = { list: async () => (await listEditablePagesAction().catch(() => [])) as Array<{ slug: string; title: string; href: string }> };

export function CanvasEditor({ slug, orgId, initial, version, blockEditorHref }: { slug: string; orgId: string; initial: PuckDoc; version?: string; blockEditorHref?: string }) {
  const router = useRouter();
  return (
    <HouseEditor
      slug={slug}
      orgId={orgId}
      initial={initial}
      version={version}
      config={load}
      save={savePageAction}
      resolvedKeys={RESOLVED_KEYS}
      pages={pages}
      routes={{ blocks: blockEditorHref, done: `/${slug}` }}
      navigate={(href) => router.push(href)}
    />
  );
}
