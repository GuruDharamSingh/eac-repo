"use client";

import { usePathname, useRouter } from "next/navigation";
import { FieldsLens, siteFieldsRegistry, type BlockFieldMap } from "@elkdonis/house-editor/fields";
import { loadFieldsAction, saveFieldsAction } from "@/app/fields/actions";

/** Places that are editors already (the canvas, Manage, the hub): the lens stays out of their way. */
const NOT_HERE = ["/studio", "/manage", "/hub", "/account", "/login"];

/** The Fields lens on this site's pages. Only editors are ever sent this (see FieldsLensGate). */
export function FieldsLensMount({ blocks }: { blocks: { map: BlockFieldMap } }) {
  const router = useRouter();
  const path = usePathname() ?? "/";
  if (NOT_HERE.some((p) => path === p || path.startsWith(`${p}/`))) return null;
  return (
    <FieldsLens
      registry={siteFieldsRegistry}
      blocks={blocks}
      load={loadFieldsAction}
      save={saveFieldsAction}
      // "Edit the look…" goes to the canvas for a page at /p/<slug>; the home page and the rest go to the page list.
      lookHref={(p) => (p.startsWith("/p/") ? `/studio/${p.slice(3)}` : "/studio")}
      labels={{ edit: "Edit wording", done: "Done" }}
      onSaved={() => router.refresh()}
    />
  );
}
