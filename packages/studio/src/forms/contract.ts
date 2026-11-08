// ============================================================================
// @elkdonis/studio/forms: the publication forms' contract (pass 0, 2026-11-08).
// Plan: docs/open/publishing-forms-handoff/PLAN.md §3–§5.
//
// Types only. No React, no data access, no route. Every host (the Studio's
// focus mode, a site's quick compose, a hub's launch) supplies a FormHost; the
// forms never assume where the Studio lives (/studio is Puck on several sites)
// or which table a Post lands in (network writing vs a site's own post threads).
//
// The field list itself is NOT declared here. It stays in
// @elkdonis/cms-ui/compose (content-fields.ts), which these sections point at
// by group id and field name, so the hub compose popups and these forms read
// one schema.
// ============================================================================

import type * as React from 'react';
import type { StudioResult } from '../types';

export type Answers = Record<string, unknown>;

/** What a person chooses. A series is never chosen: it is a gathering that repeats and is presented as a series. */
export type FormKindId = 'post' | 'gathering' | 'artwork' | 'service';

/** What an adapter saves. `writing` = network pieces; `post` = a site's own post threads. */
export type CodeKind = 'writing' | 'post' | 'meeting' | 'series' | 'artwork' | 'service';

/** Where a form is drawn. `quick` renders the fields cms-ui marks `quick`, plus the preset line. */
export type FormTier = 'focus' | 'quick';

/** Preview placement while the design is undecided (README "Open decision"). */
export type FormLayout = 'split' | 'toggle' | 'rail';

// ── schema ──────────────────────────────────────────────────────────────────

export interface FormContext {
  orgId: string;
  orgName: string;
  /** From cms-ui ContentFieldContext: feeds, hostCandidates, canCreateTalkRoom, … */
  fields: Record<string, unknown>;
  timeZone: string;
  now: Date;
}

export interface FormSection {
  /** Anchor and rail key. Usually a cms-ui group id ("schedule", "attendance"). */
  id: string;
  label: string;
  tier: 'essentials' | 'more';
  /** cms-ui group ids and/or field names drawn in this section, in order. */
  groups?: string[];
  fields?: string[];
  /** A kind-owned section with its own UI (the session planner, the variants grid). */
  render?: string;
  /** The More row's value line when closed: "24 places · closes when it starts". */
  summary?: (a: Answers, ctx: FormContext) => string;
  /** Shown only when this holds (series-only sections). */
  when?: (a: Answers) => boolean;
  /** Drawn in quick compose too. */
  quick?: boolean;
}

export type RuleSeverity = 'block' | 'warn';

export interface FormRule {
  id: string;
  severity: RuleSeverity;
  /** Fields marked in error; the first is the anchor for the summary link. */
  fields: string[];
  /** The section whose rail item and closed More row show the problem. */
  section: string;
  /** True when the rule FAILS. */
  test: (a: Answers, ctx: FormContext) => boolean;
  /** Under the field: "This date has passed. Pick a day from today on." */
  message: string;
  /** In the alert summary: "When: the date has passed". */
  short: string;
}

export interface FormKindSchema {
  id: FormKindId;
  /** "New gathering" | "New series". */
  label: (a: Answers) => string;
  sections: FormSection[];
  rules: FormRule[];
  /** gathering + repeat.enabled + repeat.asSeries → 'series'. */
  codeKind: (a: Answers) => CodeKind;
  /** Section ids open on a fresh form. */
  defaultOpen: (a: Answers) => string[];
  /** Answers for a blank form of this kind. */
  empty: (ctx: FormContext) => Answers;
}

// ── state ───────────────────────────────────────────────────────────────────

export interface FormIssue {
  ruleId: string;
  severity: RuleSeverity;
  fields: string[];
  section: string;
  message: string;
  short: string;
  /** 'server' issues come from the save's fieldErrors and always block. */
  source: 'rule' | 'server';
}

export type SectionStatus = 'done' | 'empty' | 'error' | 'warning';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface FormState {
  kind: FormKindId;
  answers: Answers;
  openSections: string[];
  /** Field name → the preset that filled it; cleared when the field is edited. */
  fromPreset: Record<string, string>;
  presetId: string | null;
  issues: FormIssue[];
  /** Set by the first Publish press; issues show only after it. */
  validationAttempted: boolean;
  saveStatus: SaveStatus;
  savedAt: string | null;
  publishedAt: string | null;
  /** The saved record's id once there is one. */
  id: string | null;
  record: unknown;
}

export interface FormUiState {
  layout: FormLayout;
  previewOpen: boolean;
  previewMode: 'card' | 'page';
  mobileTab: 'form' | 'preview';
  stage: 'edit' | 'published';
}

// ── presets (PLAN §4) ─────────────────────────────────────────────────────────

export type PresetSource = 'item' | 'org' | 'person' | 'platform' | 'last';

export interface FormPreset {
  id: string;
  name: string;
  /** "This org's usual setup: Studio 4, 2 hours, 24 places, a reminder the day before." */
  note: string;
  kind: FormKindId;
  source: PresetSource;
  values: Partial<Answers>;
}

// ── actions and host ──────────────────────────────────────────────────────────

export interface FormSaveValue<R> {
  record: R;
  /** What the adapter could not store yet ("Per-thread email choices are kept but not sent yet"). */
  warnings: string[];
  /** Field name → messages from the server's parse. */
  fieldErrors?: Record<string, string[]>;
}

/** One kind's server side, bound by the host (today: services; later: registry entries). */
export interface FormActions<R = unknown> {
  context(orgId: string): Promise<Record<string, unknown>>;
  load?(id: string): Promise<{ answers: Answers; record: R } | null>;
  save(orgId: string, answers: Answers, intent: 'draft' | 'published', id: string | null): Promise<StudioResult<FormSaveValue<R>>>;
  presets?(orgId: string, kind: FormKindId): Promise<FormPreset[]>;
  /** "Your last post's settings": a preset built from the latest record of this kind. */
  lastSettings?(orgId: string, kind: FormKindId): Promise<FormPreset | null>;
}

export interface CardRendererProps {
  kind: FormKindId | 'series';
  answers: Answers;
  mode: 'card' | 'page';
  ctx: FormContext;
}
export type CardRenderer = (props: CardRendererProps) => React.ReactNode;

export interface StudioHrefOptions {
  kind: FormKindId;
  id?: string;
  preset?: string;
  focus?: boolean;
  org?: string | null;
}

/** Everything that differs between hosts. Nothing in forms assumes a route or a table. */
export interface FormHost {
  /** The authoring Studio on this host: /studio on arts-collective, /publish on hidden-enneagram. */
  studioHref(o: StudioHrefOptions): string;
  /** The published item's public page. */
  viewHref?(kind: FormKindId, record: unknown): string | null;
  preview: {
    /** The site's own cards; unset kinds fall back to the cms-ui surface cards. */
    cards?: Partial<Record<FormKindId | 'series', CardRenderer>>;
    /** The target org's site_themes vars, applied to the preview frame. */
    themeVars?: Record<string, string>;
  };
  /** "Goes on". */
  feeds: Array<{ slug: string; name: string }>;
  actions: Partial<Record<FormKindId, FormActions>>;
  /** After a publish: the Channel delivery close, a parent-frame message, a refresh. */
  onSaved?(kind: FormKindId, record: unknown): void;
  onPublished?(kind: FormKindId, record: unknown): void;
  /** Rich widgets the host already bundles (RichTextEditor, MediaPicker); see cms-ui ContentComposerSlots. */
  slots?: Record<string, unknown>;
}

// ── framed surface (PLAN §6, from hidden-enneagram components/publish/bridge.ts) ──
//
// The frame posts these to its own origin, only when framed (parent ≠ self and
// the parent's origin is its own, in try/catch). The host listens with
// `e.origin === location.origin && e.source === frame.contentWindow`.
//
// There is no navigate message. The HOST detects navigation in the frame's
// onLoad by reading contentWindow.location: a path outside the Studio route
// (from FormHost.studioHref) or /login closes the popup and pushes that path
// on the parent. That catches links the Studio itself doesn't know about.
//
// Refresh rule: saved/published only set a `changed` flag; the host refreshes
// once, when the popup closes or unmounts. `published` also closes the popup.
// Never refresh while the frame is open (it reloads the frame mid-typing).

export const FRAME_MESSAGE_SOURCE = 'eac-forms' as const;

export type FrameMessage = { source: typeof FRAME_MESSAGE_SOURCE } & (
  | { type: 'saved'; kind: FormKindId; id: string }
  | { type: 'published'; kind: FormKindId; id: string; href: string | null }
  | { type: 'close' }
);

// ── theme (PLAN §5) ─────────────────────────────────────────────────────────

/** Icon names the forms ask for; a theme maps them onto its library (Phosphor duotone, lucide…). */
export type FormIconName =
  | 'back' | 'caret' | 'clock' | 'preset' | 'done' | 'empty' | 'error' | 'warning' | 'close' | 'plus' | 'minus'
  | 'drag' | 'focal' | 'upload' | 'library' | 'camera' | 'image' | 'page' | 'public' | 'members' | 'date'
  | 'skip' | 'restore' | 'place' | 'link' | 'talk' | 'questions' | 'poll' | 'attach' | 'preview' | 'previewOff'
  | 'expand' | 'external' | 'copy' | 'check' | 'spinner' | 'person' | 'list' | 'more';

export type FormIconMap = Record<FormIconName, React.ComponentType<{ size?: number; className?: string }>>;

export interface FormTheme {
  id: string;
  /** Value of [data-form-theme]; the theme's CSS redefines --frm-* under it. */
  attr: string;
  icons: FormIconMap;
}
