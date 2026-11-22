"use client";

import { useRouter } from "next/navigation";
import type { PuckDoc } from "@elkdonis/direct-edit/block";
import { HouseEditor } from "@elkdonis/house-editor";
import { RESOLVED_KEYS } from "@/blocks/resolved-keys";
import { savePageAction } from "@/lib/puck/actions";
import { TEMPLATE_SLUGS } from "@/lib/puck/reserved";

// The page editor at /studio/<slug>: the house canvas (@elkdonis/house-editor) bound to this site's catalogue,
// save action and routes. Saves are guarded by the page's version (loadPageWithVersion on the route).

const KEYS: Record<string, readonly string[]> = { ...RESOLVED_KEYS, "thread-feed": ["items"] };

/** A template has no page of its own to look at after saving, so the reach of a save is said before it. */
const TEMPLATE_NOTICE: Record<string, string> = {
  "event-detail": "This template draws every event's page. Saving changes all of them right away.",
  "journal-piece": "This template draws every piece of writing's page. Saving changes all of them right away.",
};

/** The catalogue, picture chooser and record sources load on opening: a visitor's page references none of them. */
const load = async () => {
  const [{ canvasConfig, canvasContract, puckConfig }, { choosePicture }, { records }] = await Promise.all([
    import("@/lib/puck/config.client"),
    import("@/components/studio/page-picture-chooser"),
    import("@/components/landing/person-records"),
  ]);
  return { canvasConfig, puckConfig, contract: canvasContract, choosePicture, records };
};

export function CanvasEditor({ slug, orgId, initial, version, blockEditorHref, record }: { slug: string; orgId: string; initial: PuckDoc; version?: string; blockEditorHref?: string; record?: { threadId?: string; piece?: string } }) {
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
      // A template opened on one record draws that gathering, post or piece (app/studio/[slug]/record.ts).
      record={record}
      saveNotice={Object.prototype.hasOwnProperty.call(TEMPLATE_NOTICE, slug) ? TEMPLATE_NOTICE[slug] : undefined}
      // A template draws no page of its own: back to the page list.
      routes={{ blocks: blockEditorHref, done: TEMPLATE_SLUGS.has(slug) ? "/manage/builder" : `/${slug}` }}
      navigate={(href) => router.push(href)}
      // Block settings as a Content tab beside Look (PLAN 9 step A), tried here first.
      flags={{ contentTab: true }}
    />
  );
}
