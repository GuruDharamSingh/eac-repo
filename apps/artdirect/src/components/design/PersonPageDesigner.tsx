"use client";

import { createElement, useCallback, useMemo, type ReactNode } from "react";
import type { Data, Plugin } from "@puckeditor/core";
import {
  FEATURED_PAGE_BLOCKS,
  FEATURED_TEMPLATES,
  PROFILE_PAGE_BLOCKS,
  PROFILE_TEMPLATE,
  personPageResolvers,
  type PersonBlockContext,
  type PropDef,
} from "@elkdonis/blocks";
import { PuckEditor, buildEditorConfig, templatesPlugin } from "@elkdonis/page-builder";
import { publishPersonPageAction, savePersonPageDraftAction } from "@/lib/person-page-actions";
import { OfferingPickerField } from "./OfferingPickerField";

// ============================================================================
// The designer for a person's own pages on ArtDirect: /<slug>/design (their
// profile page) and /<slug>/featured/design (their featured page).
//
// The canvas is wrapped in the same frame as the published page
// (`.eac-person-page.eac-person-page--frame.oad-person`), so what is arranged
// here is what shows there. The person blocks read `metadata.person`, loaded
// by the route; the resolvers are the published page's own
// (personPageResolvers), so there is no HTTP twin.
//
// Header: "Save draft" keeps work without showing it; "Publish" puts it live
// at once. Both are server actions that read the acting user from the session.
// ============================================================================

export type DesignerKind = "profile" | "featured";

export interface PersonPageDesignerProps {
  kind: DesignerKind;
  /** The person whose page this is (their ArtDirect slug). */
  slug: string;
  displayName: string;
  /** The designer is the person themselves, not an admin on their behalf. */
  isSelf: boolean;
  initial: Data;
  context: PersonBlockContext;
  /** What the page is now: live, draft only, or not yet saved. */
  state: "published" | "draft" | "new";
  /** The profile uses the dossier layout, which a designed profile does not replace. */
  dossierLayout?: boolean;
}

/** The published page's frame, around the canvas. */
function FrameWrap({ children }: { settings: Record<string, unknown>; children?: ReactNode }) {
  return (
    <div className="eac-person-page eac-person-page--frame oad-person" data-person-page="">
      <div className="oad-person-doc">{children}</div>
    </div>
  );
}

function PagePanel({ kind, slug, isSelf, displayName, state, dossierLayout }: PersonPageDesignerProps) {
  const live = kind === "profile" ? `/${slug}` : `/${slug}/featured`;
  const other = kind === "profile" ? `/${slug}/featured/design` : `/${slug}/design`;
  const whose = isSelf ? "your" : `${displayName}'s`;
  const p: React.CSSProperties = { margin: 0, fontSize: 13, lineHeight: 1.5 };
  return (
    <div style={{ padding: 16, display: "grid", gap: 12, fontFamily: "var(--puck-font-family, system-ui)" }}>
      <p style={p}>
        {kind === "profile"
          ? `This is ${whose} page at ${live}. Arrange its parts, add pictures and words, or take parts away.`
          : `This is ${whose} featured page at ${live}: a page to bring one offering, or several, to people's attention.`}
      </p>
      <p style={p}>
        <strong>Save draft</strong> keeps your work without showing it. <strong>Publish</strong> puts this page live
        straight away.
      </p>
      <p style={p}>
        Status:{" "}
        <strong>
          {state === "published" ? "live (Publish replaces it)" : state === "draft" ? "saved as a draft, not live" : "not saved yet"}
        </strong>
      </p>
      {kind === "profile" && dossierLayout ? (
        <p style={p}>
          {isSelf ? "Your" : "This"} page uses the dossier layout. A published design shows once the page is switched
          to the standard layout in the “Your file” panel.
        </p>
      ) : null}
      {kind === "profile" ? (
        <p style={p}>Name, portrait, bio and links come from {whose} profile; change them in the “Your file” panel on the page.</p>
      ) : null}
      <p style={p}>
        <a href={live}>{state === "published" ? "View the live page" : "Back to the page"}</a>
        {" · "}
        <a href={other}>{kind === "profile" ? "Design the featured page" : "Design the profile page"}</a>
      </p>
    </div>
  );
}

export function PersonPageDesigner(props: PersonPageDesignerProps) {
  const { kind, slug, initial, context, displayName, isSelf } = props;
  const offerings = context.offerings;

  const config = useMemo(
    () =>
      buildEditorConfig({
        resolvers: personPageResolvers(),
        blocks: kind === "profile" ? PROFILE_PAGE_BLOCKS : FEATURED_PAGE_BLOCKS,
        root: { props: [], wrap: FrameWrap },
        media: {
          // ArtDirect's own upload route, into this person's media folder;
          // `target=page` returns the picture without adding it to their gallery.
          uploadEndpoint: `/api/upload?${new URLSearchParams({ slug, target: "page" })}`,
        },
        fields: {
          string: (prop: PropDef) =>
            prop.binds === "record"
              ? function OfferingProp(p: Record<string, unknown>) {
                  return createElement(OfferingPickerField, { ...(p as object), offerings } as never);
                }
              : null,
        },
      }),
    [kind, slug, offerings]
  );

  const metadata = useMemo(() => ({ person: context }), [context]);

  const onPublish = useCallback((_key: string, data: Data) => publishPersonPageAction(slug, kind, data), [slug, kind]);
  const onSaveDraft = useCallback((_key: string, data: Data) => savePersonPageDraftAction(slug, kind, data), [slug, kind]);

  const plugins = useMemo<Plugin[]>(
    () => [
      {
        name: "person-page",
        label: "Page",
        render: () => <PagePanel {...props} />,
      },
      // Profile: back to the page as it is now. Featured: the promotion templates.
      templatesPlugin(kind === "profile" ? [PROFILE_TEMPLATE] : FEATURED_TEMPLATES),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind, slug, props.state, props.dossierLayout]
  );

  const whose = isSelf ? "Your" : `${displayName}'s`;
  return (
    <PuckEditor
      slug={kind}
      initial={initial}
      config={config}
      orgId="oad"
      metadata={metadata}
      onPublish={onPublish}
      onSaveDraft={onSaveDraft}
      publishedLabel="Published — live now"
      plugins={plugins}
      title={kind === "profile" ? `${whose} page — /${slug}` : `${whose} featured page — /${slug}/featured`}
    />
  );
}
