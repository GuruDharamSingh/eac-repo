"use client";

import * as React from "react";
import type { FormHost, FormKindId } from "@elkdonis/studio-forms";
import { SurfaceFrame, SurfaceSkeleton, useLayer, useSurface, type SurfaceAction, type SurfaceDescriptor } from "@elkdonis/cms-ui/surface";
import { makeFormHost, type SiteFormSite } from "./host";
import { SiteFormInner, schemaOf, useSiteFormBoot } from "./SiteForm";

/**
 * A site's compose popup, drawn from the shared studio-forms forms (2026-11-14).
 *
 * A surface layer: registered as `connectors.custom["compose:<kind>"]` and drawn inside the host's
 * SurfaceFrame, so the head, foot, close and back are the surface system's. Save draft and Publish are the
 * foot's buttons; "Open full form" draws the norm tier (all sections) in the same layer.
 * SiteFormPage draws the same form on a plain page.
 */

type Descriptor = Extract<SurfaceDescriptor, { type: "custom" }>;

export function SiteFormSurface({ kind, site, descriptor }: { kind: FormKindId; site: SiteFormSite; descriptor: Descriptor }) {
  const { connectors, pop } = useSurface();
  const layer = useLayer();
  const schema = schemaOf(kind);
  const threadId = typeof descriptor.props?.threadId === "string" ? descriptor.props.threadId : null;
  // A new item's starting answers: `initialAnswers`, and the catalogue's `prefill` (answers such as a
  // title typed in a compose bar, or a title string).
  const raw = descriptor.props?.prefill;
  const prefill = typeof raw === "string" ? { title: raw } : raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  const given = descriptor.props?.initialAnswers;
  const initialAnswers = given && typeof given === "object" ? { ...(prefill ?? {}), ...(given as Record<string, unknown>) } : prefill;
  const { boot, error } = useSiteFormBoot(kind, site, threadId, initialAnswers);
  const host = React.useMemo<FormHost>(
    () => makeFormHost(site, { media: connectors.composeSlots?.media as never, body: connectors.composeSlots?.body as never }),
    [site, connectors.composeSlots]
  );

  if (!schema || error || !boot) {
    return (
      <SurfaceFrame kind={kind} title={descriptor.title ?? "New"} status={error} statusTone={error ? "error" : "normal"}>
        {error ? <p className="eac-surface-empty">{error}</p> : <SurfaceSkeleton />}
      </SurfaceFrame>
    );
  }
  return (
    <SiteFormInner
      kind={kind}
      schema={schema}
      host={host}
      boot={boot}
      onPublished={() => connectors.onMutated?.()}
      frame={(c, form) => {
        // The surface tells its shell the width: compact for the quick tier.
        // eslint-disable-next-line react-hooks/rules-of-hooks
        React.useEffect(() => layer.setMeta({ title: c.title, kind, size: c.tier === "quick" ? "compact" : "wide" }), [c.tier, c.title]);
        const actions: SurfaceAction[] =
          c.stage === "published"
            ? [{ label: "Done", primary: true, onClick: pop }]
            : [
                { label: c.tier === "quick" ? "Open full form" : "Fewer options", quiet: true, onClick: c.toggleTier },
                { label: "Cancel", quiet: true, onClick: pop, disabled: c.busy },
                ...(c.published || !c.canDraft ? [] : [{ label: c.pending === "draft" ? "Saving…" : "Save draft", onClick: c.saveDraft, disabled: c.busy } satisfies SurfaceAction]),
                {
                  label: c.pending === "publish" ? (c.published ? "Saving…" : "Publishing…") : c.published ? "Save changes" : c.canDraft ? "Publish" : "Create",
                  primary: true,
                  onClick: c.publish,
                  disabled: c.busy,
                },
              ];
        return (
          <SurfaceFrame kind={kind} title={c.title} kicker={c.tier === "quick" ? "Quick add" : undefined} actions={actions} status={c.status} statusTone={c.statusTone}>
            {form}
          </SurfaceFrame>
        );
      }}
    />
  );
}

/**
 * `connectors.custom["compose:<id>"]`: `custom: { ...siteFormConnectors(site, ["meeting", { id: "article", kind: "post" }]) }`.
 * A bare kind uses its own id; the compose catalogue's ids differ for the post (`article`).
 */
export function siteFormConnectors(site: SiteFormSite, kinds: Array<FormKindId | { id: string; kind: FormKindId }>) {
  const out: Record<string, (p: { descriptor: Descriptor }) => React.ReactNode> = {};
  for (const entry of kinds) {
    const { id, kind } = typeof entry === "string" ? { id: entry, kind: entry } : entry;
    out[`compose:${id}`] = ({ descriptor }) => <SiteFormSurface kind={kind} site={site} descriptor={descriptor} />;
  }
  return out;
}
