"use client";

import { usePathname, useRouter } from "next/navigation";
import { FieldsLens, type BlockFieldMap } from "@elkdonis/house-editor/fields";
import { loadFieldsAction, restoreFieldsAction, saveFieldsAction } from "@/app/fields/actions";
import { elktoursFieldsRegistry } from "@/lib/tour-fields-registry";

/** Places that are editors already (the canvas, Manage, the hub): the lens stays out of their way. */
const NOT_HERE = ["/studio", "/manage", "/hub", "/account", "/login"];

/** The Fields lens on this site's pages. Only editors are ever sent this (see FieldsLensGate). */
export function FieldsLensMount({ blocks }: { blocks: { map: BlockFieldMap } }) {
  const router = useRouter();
  const path = usePathname() ?? "/";
  if (NOT_HERE.some((p) => path === p || path.startsWith(`${p}/`))) return null;
  return (
    <FieldsLens
      registry={elktoursFieldsRegistry}
      blocks={blocks}
      load={loadFieldsAction}
      save={saveFieldsAction}
      restore={restoreFieldsAction}
      // "Edit the look…" goes to the canvas for this page. A tour's page is not redesigned from here: no link.
      lookHref={(p) => (p.startsWith("/tours/") ? null : /^\/[a-z0-9-]+$/.test(p) ? `/studio${p}` : "/manage/builder")}
      labels={path.startsWith("/tours/") ? { edit: "Edit this tour", done: "Done" } : { edit: "Edit wording", done: "Done" }}
      onSaved={() => router.refresh()}
    />
  );
}
