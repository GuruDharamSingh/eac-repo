"use client";

import * as React from "react";
import { MediaPicker } from "@elkdonis/cms-ui/files";
import {
  FormShell,
  artworkActions,
  artworkAnswers,
  artworkKind,
  quickFormTheme,
  useFormState,
  useFormUi,
  type ArtworkContextView,
  type ArtworkRecordView,
  type FormContext,
  type FormHost,
  type MediaSlot,
} from "@elkdonis/studio-forms";
import "@elkdonis/studio-forms/forms.css";
import "@elkdonis/studio-forms/ledger.css";
import { channelArtworkContextAction, channelArtworkLoadAction, channelArtworkSaveAction } from "@/lib/channel-artwork-actions";
import { siteConfig } from "@/config/site";

/**
 * The Studio's artwork form at the quick tier, on katie's /channel (2026-11-12).
 * Quick-Form look since 2026-11-14 (`quickFormTheme`, ledger.css "Quick-Form"; approved by the
 * developer, docs/open/STUDIO_FORMS_SPLIT_2026-11-14.md §7): the theme sets its own tokens, so
 * the site's --eac-form-* overrides were removed; its fonts (IBM Plex Sans, Newsreader) load here.
 * Quick tier: Pictures, Title, Price (schema.ts `quick: true`).
 * Everything else is "More options in Studio" (the shell's Studio link = props.studioHref).
 * Props are fixed by the /channel page; the org prop is checked server-side against
 * siteConfig.orgId and otherwise ignored.
 */

/** The Quick-Form theme's fonts (ledger.css names them; the host loads them, as the Studio page does). */
const QUICK_FONTS =
  "https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500&family=IBM+Plex+Sans:wght@400;500;600&display=swap";

const mediaSlot: MediaSlot = ({ onChange, label, hint, accept }) => (
  <MediaPicker
    onChange={(url) => onChange(url)}
    uploadEndpoint="/api/media/upload"
    libraries={[
      { key: "site", label: "This site", endpoint: "/api/media/library" },
      { key: "mine", label: "My files", endpoint: "/api/media/library/mine" },
    ]}
    label={label ?? "Picture"}
    hint={hint}
    accept={accept ?? "image/*"}
  />
);

const actions = artworkActions({
  context: channelArtworkContextAction,
  loadArtwork: channelArtworkLoadAction,
  saveArtwork: channelArtworkSaveAction,
});

type Props = { orgId: string; artworkId: string | null; studioHref: string; closeHref: string };

function Inner({ props, ctx, record }: { props: Props; ctx: FormContext; record: ArtworkRecordView | null }) {
  const host = React.useMemo<FormHost>(
    () => ({
      studioHref: () => props.studioHref,
      viewHref: (ref) => ref.href ?? null,
      loginHref: (next) => `/login?next=${encodeURIComponent(next)}`,
      preview: {},
      feeds: [],
      actions: { artwork: actions },
      slots: { media: mediaSlot },
    }),
    [props.studioHref]
  );
  const ctl = useFormState({
    schema: artworkKind,
    ctx,
    orgId: ctx.orgId,
    actions,
    init: record
      ? { answers: artworkAnswers(record), id: record.id, record, publishedAt: record.publishedAt, savedAt: record.updatedAt, saveStatus: "saved" }
      : undefined,
    autosaveMs: 2500,
  });
  const [ui, setUi] = useFormUi();
  return (
    <FormShell
      schema={artworkKind}
      state={ctl.state}
      ui={ui}
      host={host}
      ctx={ctx}
      theme={quickFormTheme}
      tier="quick"
      kinds={["artwork"]}
      scope="ktp-"
      on={{
        patch: ctl.patch,
        toggleSection: ctl.toggleSection,
        ui: setUi,
        saveDraft: ctl.saveDraft,
        publish: ctl.publish,
        applyPreset: ctl.applyPreset,
        unpublish: () => ctl.dispatch({ type: "unpublish" }),
        close: () => window.location.assign(props.closeHref),
      }}
    />
  );
}

export function ArtworkQuickForm(props: Props): React.JSX.Element {
  const [ready, setReady] = React.useState<{ ctx: FormContext; record: ArtworkRecordView | null } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let live = true;
    (async () => {
      try {
        const fields = (await channelArtworkContextAction(siteConfig.orgId)) as ArtworkContextView;
        const record = props.artworkId ? await channelArtworkLoadAction(props.artworkId) : null;
        if (!live) return;
        if (!fields.canEdit) return setError(fields.reason ?? "You cannot add pieces here.");
        if (props.artworkId && !record) return setError("That piece was not found in this store.");
        setReady({
          ctx: { orgId: siteConfig.orgId, orgName: siteConfig.orgName, fields: { ...fields }, timeZone: "America/Toronto", now: new Date() },
          record,
        });
      } catch {
        if (live) setError("Could not open the form. Reload and try again.");
      }
    })();
    return () => {
      live = false;
    };
  }, [props.artworkId]);

  return (
    <div className="ktp-channel-artwork-form">
      <link rel="stylesheet" href={QUICK_FONTS} precedence="default" />
      {error ? (
        <p role="alert">
          {error} <a href={props.closeHref}>Back</a>
        </p>
      ) : ready ? (
        <Inner props={props} ctx={ready.ctx} record={ready.record} />
      ) : (
        <p aria-busy="true">Opening…</p>
      )}
    </div>
  );
}
