"use client";

import { usePathname, useRouter } from "next/navigation";
import { FieldsLens, type BlockFieldMap } from "@elkdonis/house-editor/fields";
import { getEditEntry, setEditing, setLive, useEditEntry } from "@elkdonis/house-editor/entry";
import { choosePicture } from "@/components/landing/page-picture-chooser";
import { loadFieldsAction, restoreFieldsAction, saveFieldsAction } from "@/app/fields/actions";
import { elktoursFieldsRegistry } from "@/lib/tour-fields-registry";

/** Places that are editors already (the canvas, Manage, the hub): the lens stays out of their way. */
const NOT_HERE = ["/studio", "/manage", "/hub", "/account", "/login"];

/** The Fields lens on this site's pages. Only editors are ever sent this (see FieldsLensGate). */
export function FieldsLensMount({ blocks }: { blocks: { map: BlockFieldMap } }) {
  const router = useRouter();
  const entry = useEditEntry();
  const path = usePathname() ?? "/";
  if (NOT_HERE.some((p) => path === p || path.startsWith(`${p}/`))) return null;
  return (
    <FieldsLens
      registry={elktoursFieldsRegistry}
      blocks={blocks}
      load={loadFieldsAction}
      save={saveFieldsAction}
      restore={restoreFieldsAction}
      // The site's own picker (upload and the library), as the landing editor uses it.
      choosePicture={choosePicture}
      // "Edit the look…" goes to the canvas for this page. A tour's page is not redesigned from here: no link.
      lookHref={(p) => (p.startsWith("/tours/") ? null : /^\/[a-z0-9-]+$/.test(p) ? `/studio${p}` : "/manage/builder")}
      // The Edit button's "Live edit" turns it on; its own bar says so and has Done.
      live={{ on: entry.live, onExit: () => setLive(false) }}
      onSaved={() => router.refresh()}
    />
  );
}
