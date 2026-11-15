"use client";

import * as React from "react";
import {
  AfterPublish,
  AlertSummary,
  FormRoot,
  FormSections,
  PresetSlot,
  orderPresets,
  artworkKind,
  clockIn,
  eventKind,
  meetingKind,
  seriesKind,
  sitePostKind,
  workshopKind,
  quickFormTheme,
  readiness,
  serviceKind,
  shownIssues,
  useFormState,
  type FormContext,
  type FormController,
  type FormHost,
  type FormKindId,
  type FormKindSchema,
  type FormPreset,
  type FormState,
} from "@elkdonis/studio-forms";
import "@elkdonis/studio-forms/forms.css";
import "@elkdonis/studio-forms/ledger.css";
import { audienceAnswers, type SiteFormSite } from "./host";

// ============================================================================
// The part of a site's form that does not depend on where it is drawn (2026-11-14).
// SiteFormSurface (a popup layer) and SiteFormPage (a plain page) load the same context and record,
// draw the same FormSections on the Quick-Form theme, and share save, publish, tier and AfterPublish.
// They differ only in their outer frame: where the buttons and the status line sit.
// FormShell is not used: outside the Studio it draws its own bars and rail, which double a frame's chrome.
// ============================================================================

const SCHEMAS: Partial<Record<FormKindId, FormKindSchema>> = {
  post: sitePostKind,
  series: seriesKind,
  meeting: meetingKind,
  event: eventKind,
  workshop: workshopKind,
  artwork: artworkKind,
  service: serviceKind,
};

export function schemaOf(kind: FormKindId): FormKindSchema | null {
  return SCHEMAS[kind] ?? null;
}

/** The Quick-Form theme's fonts (ledger.css names them; the host loads them). */
const QUICK_FONTS =
  "https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500&family=IBM+Plex+Sans:wght@400;500;600&display=swap";

export type Boot = { ctx: FormContext; init?: Partial<FormState> };

/** Answers a new item starts with: `section` is accepted for the feed (`feed_slug`). */
function startAnswers(initial: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!initial) return {};
  const out: Record<string, unknown> = { ...initial };
  if (typeof out.section === "string" && out.feed_slug === undefined) out.feed_slug = out.section;
  delete out.section;
  return out;
}

/** Loads the kind's context (and the record, when editing). `error` is a sentence for the person. */
export function useSiteFormBoot(
  kind: FormKindId,
  site: SiteFormSite,
  threadId: string | null,
  /** A new item's starting answers (a feed from `?feed=`, a title from the catalogue). Ignored when editing. */
  initialAnswers?: Record<string, unknown> | null
): { boot: Boot | null; error: string | null } {
  const actions = site.kinds[kind]?.actions;
  const [boot, setBoot] = React.useState<Boot | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!actions) return setError("This site cannot make that here.");
    let live = true;
    (async () => {
      try {
        const fields = await actions.context(site.orgId);
        if (fields.canEdit === false) return live && setError(String(fields.reason ?? "You cannot add this here."));
        const loaded = threadId && actions.load ? await actions.load(threadId) : null;
        if (threadId && !loaded) return live && setError("Could not load it to edit.");
        if (!live) return;
        const rec = loaded?.record as { id?: string; publishedAt?: string | null; updatedAt?: string } | undefined;
        const ctx: FormContext = {
          orgId: site.orgId,
          orgName: site.orgName,
          fields: {
            ...fields,
            feeds: fields.feeds ?? site.feeds,
            ...(site.defaultAudience ? { defaultAudience: site.defaultAudience } : {}),
            ...(site.materials ? { canAttachMaterials: true } : {}),
            ...(site.meetingOptions?.cycleBadge ? { canShowCycleBadge: true } : {}),
          },
          timeZone: site.timeZone,
          now: new Date(),
        };
        const schema = schemaOf(kind);
        const start = { ...audienceAnswers(site.defaultAudience), ...startAnswers(initialAnswers) };
        setBoot({
          ctx,
          init: loaded
            ? { answers: loaded.answers, id: rec?.id ?? threadId, record: loaded.record, publishedAt: rec?.publishedAt ?? null, savedAt: rec?.updatedAt ?? null, saveStatus: "saved" }
            : schema && Object.keys(start).length
              ? { answers: { ...schema.empty(ctx), ...start } }
              : undefined,
        });
      } catch {
        if (live) setError("Could not open the form. Close it and try again.");
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, threadId]);
  return { boot, error };
}

/** What a frame needs to draw its buttons and status line. */
export interface SiteFormControls {
  tier: "quick" | "focus";
  toggleTier: () => void;
  stage: "edit" | "published";
  published: boolean;
  /** False for a kind with no drafts (series): the frame draws no Save draft. */
  canDraft: boolean;
  busy: boolean;
  pending: null | "draft" | "publish";
  saveDraft: () => void;
  publish: () => void;
  status: string | null;
  statusTone: "normal" | "error";
  title: string;
  state: FormState;
}

export function SiteFormInner({
  kind,
  schema,
  host,
  boot,
  onPublished,
  onDone,
  frame,
}: {
  kind: FormKindId;
  schema: FormKindSchema;
  host: FormHost;
  boot: Boot;
  /** After a publish saved (a surface calls connectors.onMutated). */
  onPublished?: () => void;
  /** The frame's way out, for AfterPublish's "Done" (a frame draws it). */
  onDone?: () => void;
  /** Draws the frame around the form: `children` is the form body. */
  frame: (c: SiteFormControls, children: React.ReactNode) => React.ReactNode;
}) {
  const { ctx } = boot;
  const [tier, setTier] = React.useState<"quick" | "focus">("quick");
  const [stage, setStage] = React.useState<"edit" | "published">("edit");
  const [pending, setPending] = React.useState<null | "draft" | "publish">(null);
  // A series is made here and planned elsewhere: remember where its save said the planner is.
  const plannerHref = React.useRef<string | null>(null);
  const baseActions = host.actions[kind];
  const actions = React.useMemo(
    () =>
      baseActions && kind === "series"
        ? {
            ...baseActions,
            save: async (...a: Parameters<typeof baseActions.save>) => {
              const res = await baseActions.save(...a);
              const rec = res.ok ? (res.value.record as { plannerHref?: string | null } | undefined) : undefined;
              if (rec?.plannerHref) plannerHref.current = rec.plannerHref;
              return res;
            },
          }
        : baseActions,
    [baseActions, kind]
  );
  const ctl: FormController = useFormState({ schema, ctx, orgId: ctx.orgId, actions, init: boot.init, autosaveMs: 2500 });
  const { state } = ctl;
  const scope = `sf-${kind}-`;
  const clock = React.useMemo(() => clockIn(ctx.timeZone), [ctx.timeZone]);
  const published = Boolean(state.publishedAt);
  const busy = state.saveStatus === "saving";
  const ready = readiness(state, clock);
  void onDone;

  // "Start from": the kind's platform starters and "Your last <kind>'s settings" (the adapter's
  // lastSettings, which reads the site's list action). Offered on a new item only.
  const [presets, setPresets] = React.useState<FormPreset[]>([]);
  React.useEffect(() => {
    if (boot.init?.id) return;
    let live = true;
    Promise.resolve(actions?.lastSettings?.(ctx.orgId, kind) ?? null)
      .catch(() => null)
      .then((last) => live && setPresets(orderPresets(kind, [], last ?? null)));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);
  const startFrom = !state.id && presets.some((p) => Object.keys(p.values).length > 0) ? (
    <PresetSlot id={`${scope}start`} schema={schema} state={state} presets={presets} onApply={ctl.applyPreset} showNote={false} />
  ) : null;

  const publish = async () => {
    setPending("publish");
    try {
      if ((await ctl.publish()) === "published") {
        // A new series opens its planner, where it is edited.
        if (plannerHref.current) return void window.location.assign(plannerHref.current);
        setStage("published");
        onPublished?.();
      }
    } finally {
      setPending(null);
    }
  };
  const saveDraft = async () => {
    setPending("draft");
    try {
      await ctl.saveDraft();
      if (plannerHref.current) window.location.assign(plannerHref.current);
    } finally {
      setPending(null);
    }
  };

  const status =
    state.saveStatus === "error"
      ? "Not saved. Try again."
      : busy
        ? "Saving…"
        : state.validationAttempted && ready.status === "blocked"
          ? ready.text
          : state.publishedAt
            ? `Live since ${clock(state.publishedAt)}`
            : state.savedAt
              ? `Draft saved ${clock(state.savedAt)}`
              : null;

  const label = schema.label(state.answers);
  const controls: SiteFormControls = {
    tier,
    toggleTier: () => setTier((t) => (t === "quick" ? "focus" : "quick")),
    stage,
    published,
    canDraft: schema.drafts !== false,
    busy,
    pending,
    saveDraft,
    publish,
    status,
    statusTone: state.saveStatus === "error" ? "error" : "normal",
    title: state.id && published ? label.replace(/^New /, "Edit ") : label,
    state,
  };

  const form = (
    <>
      <link rel="stylesheet" href={QUICK_FONTS} precedence="default" />
      <FormRoot theme={quickFormTheme} className="frm-site" data-tier={tier}>
        {/* The label column folds away; pointing at this strip on the left edge opens it (ledger.css, "Site forms"). */}
        <span className="frm-site-edge" aria-hidden="true" />
        {stage === "published" ? (
          <AfterPublish schema={schema} state={state} host={host} ctx={ctx} kinds={[kind]} scope={scope} onKeepEditing={() => setStage("edit")} />
        ) : (
          <FormSections
            schema={schema}
            state={state}
            host={host}
            ctx={ctx}
            tier={tier}
            scope={scope}
            patch={ctl.patch}
            toggleSection={ctl.toggleSection}
            fullEditorHref={host.studioHref({ kind, id: state.id ?? undefined, focus: true })}
            before={
              <>
                {startFrom}
                {state.validationAttempted ? (
                  <AlertSummary
                    issues={shownIssues(state)}
                    saved={state.saveStatus === "saved" || Boolean(state.savedAt)}
                    scope={scope}
                    onOpenSection={(id) => ctl.toggleSection(id, true)}
                  />
                ) : null}
              </>
            }
          />
        )}
      </FormRoot>
    </>
  );
  return <>{frame(controls, form)}</>;
}
