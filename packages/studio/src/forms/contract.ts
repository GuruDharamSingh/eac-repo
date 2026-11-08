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
import type { CommonIconName, HostLinks, IconMap, StudioLinkRequest } from '@elkdonis/utils/host';
import type { ContentFieldSpec, ContentKind } from '@elkdonis/cms-ui/compose';
import type { StudioResult } from '../types';
import type { BlocksSlot, BodySlot } from './fields/FieldRenderer';
import type { MediaSlot } from './fields/MediaField';

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
  /**
   * The section's value line: beside a closed More row ("24 places · closes when it starts"),
   * and beside an Essentials heading when given (Sessions: "8 sessions · 19 Nov to 21 Jan").
   */
  summary?: (a: Answers, ctx: FormContext) => string;
  /** Shown only when this holds (series-only sections; Hosts only with hostCandidates). */
  when?: (a: Answers, ctx: FormContext) => boolean;
  /** Drawn in quick compose too. */
  quick?: boolean;
  /**
   * The rail shows the section done even with nothing typed, when its defaults already say
   * something (Also show on: the home site and the profile are listed by default).
   */
  done?: (a: Answers, ctx: FormContext) => boolean;
}

/** How a kind lays out what it draws: the body editor, side-by-side rows and indents (for the 390px reflow). */
export interface KindLayout {
  /**
   * The body slot: in focus mode `blocks` = the Studio essay Canvas (writes `body` and `body_doc`;
   * body_doc wins on save), `toolbar` = the toolbar editor (`body` HTML). Quick compose uses the lite editor for both.
   */
  body: { section: string; field: 'body'; editor: 'blocks' | 'toolbar' };
  /** Rows of side-by-side controls. `cells` maps a control's name to its CSS flex shorthand. */
  rows: Array<{ section: string; row: string; cells: Record<string, string> }>;
  /** Sub-blocks indented on desktop that keep their indent at 390px (px). */
  indents?: Array<{ section: string; block: string; px: number }>;
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

/**
 * Override for SectionProps.field(). Spec keys (input, options, label, hint, placeholder, …) are
 * merged over the cms-ui spec. `value`/`onChange` make it a VIRTUAL control that is not bound to an
 * answer key (the Repeats switch, the duration seg with Other, the Where seg); with `input` set,
 * `name` may be a key cms-ui does not declare. Inputs: 'radio' = Seg, 'toggle' = Switch,
 * 'boolean' = CheckRow, the rest as cms-ui WizardFieldInput.
 */
export interface FieldOverride {
  input?: string;
  options?: Array<{ value: string; label: string; hint?: string; icon?: FormIconName }>;
  label?: string;
  hint?: string;
  placeholder?: string;
  inline?: boolean;
  required?: boolean;
  value?: unknown;
  onChange?: (value: unknown) => void;
  [key: string]: unknown;
}

/** What a kind's own section component (FormSection.render) receives from the shell. */
export interface SectionProps {
  answers: Answers;
  patch: (fields: Partial<Answers>) => void;
  ctx: FormContext;
  /** Issues for this section, shown only once validation was attempted. */
  issues: FormIssue[];
  fromPreset: Record<string, string>;
  tier: FormTier;
  host: FormHost;
  /** The saved record's id; null on a new form (a "new only" control, such as Present it as a series, reads it). */
  recordId?: string | null;
  /** Draw one cms-ui field by name with the shell's field components (so kinds never restyle a field). */
  field: (name: string, override?: FieldOverride) => React.ReactNode;
}

export interface FormKindSchema {
  id: FormKindId;
  /**
   * Which cms-ui content-fields list supplies the field specs (labels, inputs, dependsOn).
   * Default: the code kind's. A gathering returns 'meeting' even as a series, so ticking
   * "Present it as a series" never swaps its fields for the series card's (pass 2).
   */
  specKind?: (a: Answers) => ContentKind | null;
  /** Specs for fields content-fields does not declare (artwork), merged over that list. */
  specs?: Record<string, ContentFieldSpec>;
  /** Draft autosave for these answers. Default true. Off for a series: each save rebuilds the draft. */
  autosave?: (a: Answers) => boolean;
  /** FormSection.render keys → components. Owned by the kind (soft tissue); drawn by the shell (tendons). */
  components?: Record<string, React.ComponentType<SectionProps>>;
  /** Sections the design shows that this pass leaves out, with the reason and the pass that brings them (PLAN §1). */
  deferred?: Array<{ id: string; label: string; reason: string; pass: number }>;
  /** "New gathering" | "New series". */
  label: (a: Answers) => string;
  sections: FormSection[];
  rules: FormRule[];
  layout?: KindLayout;
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
  /** An edit landed while a save was in flight: that save does not cover it, so another is due. */
  editedWhileSaving: boolean;
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
  /**
   * `opts.autosave`: nobody pressed anything. The adapter forwards it so the server refuses an
   * autosave over a row that is no longer a draft (meeting-content.ts saveMeetingContent opts).
   */
  save(
    orgId: string,
    answers: Answers,
    intent: 'draft' | 'published',
    id: string | null,
    opts?: { autosave?: boolean }
  ): Promise<StudioResult<FormSaveValue<R>>>;
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

/** A Studio link from the forms: the shared request, with the forms' kind. */
export type StudioHrefOptions = StudioLinkRequest & { kind: FormKindId };

/**
 * Everything that differs between hosts. Nothing in forms assumes a route or a table.
 * The links (studioHref: /studio on arts-collective, /publish on hidden-enneagram;
 * viewHref; loginHref; studioPaths for the frame check) come from the shared HostLinks.
 */
export interface FormHost extends HostLinks {
  preview: {
    /** The site's own cards; unset kinds fall back to the cms-ui surface cards. */
    cards?: Partial<Record<FormKindId | 'series', CardRenderer>>;
    /** The target org's site_themes vars, applied to the preview frame. */
    themeVars?: Record<string, string>;
    /**
     * The faded neighbour item under the preview: a real one from the target feed
     * ("Earlier" / "Coming up" + its title). Unset or null draws none (no invented rows).
     */
    neighbour?: Partial<Record<FormKindId | 'series', { label: string; title: string } | null>>;
    /**
     * Where the item shows on this site, for "Preview on …" and the breadcrumb ("Series",
     * "Store", "Offerings"). Unset falls back to the chosen feed's name, then to the defaults.
     */
    place?: Partial<Record<FormKindId | 'series', string>>;
  };
  /** "Goes on". */
  feeds: Array<{ slug: string; name: string }>;
  actions: Partial<Record<FormKindId, FormActions>>;
  /** After a publish: the Channel delivery close, a parent-frame message, a refresh. */
  onSaved?(kind: FormKindId, record: unknown): void;
  onPublished?(kind: FormKindId, record: unknown): void;
  /**
   * Rich widgets the host already bundles. `blocks`: the essay Canvas (focus, Post body);
   * `body`: a toolbar editor (cms-ui RichTextEditor); `media`: the picker. Quick compose
   * always uses the lite editor, so `./forms` never needs tiptap.
   */
  slots?: { body?: BodySlot; blocks?: BlocksSlot; media?: MediaSlot; [key: string]: unknown };
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

/** Icon names the forms ask for: the shared set plus the forms' own. A theme maps them onto its library. */
export type FormIconName =
  | CommonIconName
  | 'preset' | 'drag' | 'focal' | 'page' | 'skip' | 'restore' | 'place' | 'talk' | 'questions' | 'poll' | 'attach';

export type FormIconMap = IconMap<FormIconName, React.ComponentType<{ size?: number; className?: string }>>;

export interface FormTheme {
  id: string;
  /** Value of [data-form-theme]; the theme's CSS redefines --frm-* under it. */
  attr: string;
  icons: FormIconMap;
}
