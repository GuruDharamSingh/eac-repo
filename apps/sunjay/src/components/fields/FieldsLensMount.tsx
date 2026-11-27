"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FieldsLens, type BlockFieldMap, type FieldsRecordSources } from "@elkdonis/house-editor/fields";
import { getEditEntry, setEditing, setLive, useEditEntry } from "@elkdonis/house-editor/entry";
import { fields } from "@/lib/fields";
import { choosePicture } from "@/components/studio/page-picture-chooser";
import { loadFieldsAction, saveFieldsAction } from "@/app/fields/actions";

/** Places that are editors already (the canvas, Manage, the hub): the lens stays out of their way. */
const NOT_HERE = ["/studio", "/manage", "/hub", "/account"];

/** The home page edits as a tree in place: the page registered how (the Edit button's "Edit page"). */
function openLandingCanvas(): void {
  const open = getEditEntry().editPage;
  if (open) void Promise.resolve(open()).then(() => setEditing(true));
  else window.location.assign("/manage/builder");
}

/** The Fields lens on Para Theater's pages. Only editors are ever sent this (see FieldsLensGate). */
export function FieldsLensMount({ blocks }: { blocks?: { map: BlockFieldMap } }) {
  const router = useRouter();
  const entry = useEditEntry();
  const path = usePathname() ?? "/";
  // Where a card's record is chosen from: the same "From what?" lists the canvas editor uses, loaded when the lens is.
  const [records, setRecords] = useState<FieldsRecordSources | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void import("@/components/landing/person-records").then((m) => { if (live) setRecords(m.records as FieldsRecordSources); }).catch(() => {});
    return () => { live = false; };
  }, []);
  if (NOT_HERE.some((p) => path === p || path.startsWith(`${p}/`))) return null;
  return (
    <FieldsLens
      registry={fields}
      blocks={blocks}
      load={loadFieldsAction}
      save={saveFieldsAction}
      choosePicture={choosePicture}
      records={records}
      // "Edit the look…" is the canvas door: the home page opens its canvas in place; the other pages go to the page list.
      lookHref="/manage/builder"
      onLook={path === "/" ? openLandingCanvas : undefined}
      // The Edit button's "Live edit" turns it on; its own bar says so and has Done.
      live={{ on: entry.live, onExit: () => setLive(false) }}
      onSaved={() => router.refresh()}
    />
  );
}
