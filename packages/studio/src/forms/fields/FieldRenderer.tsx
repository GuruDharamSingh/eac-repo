'use client';

import * as React from 'react';
import type { ContentFieldSpec } from '@elkdonis/cms-ui/compose';
import { fieldDependencySatisfied, type WizardFieldSpec } from '@elkdonis/cms-ui/wizard';
import type { Answers, FieldOverride, FormContext, FormHost, FormIconName, FormIssue, FormTier } from '../contract';
import { readAnswer } from '../state';
import { CheckList, CheckRow } from './CheckRow';
import { PeopleInput, TagInput, type PersonOption } from './Chips';
import { CreditRows } from './CreditRows';
import { Field, fieldAria, type FieldLock, type FieldProblem } from './Field';
import { fieldId } from './ids';
import { DateTimeInput, Input, Select, Textarea, type SelectOption } from './Input';
import { LiteEditor } from './LiteEditor';
import { MediaField, type Focal, type MediaSlot } from './MediaField';
import { PicturesField } from './PicturesField';
import { Seg } from './Seg';
import { Switch } from './Switch';
import { Title } from './Title';

// ============================================================================
// FieldRenderer: a cms-ui field spec → the shell's field components, so a
// kind draws any field by name (SectionProps.field) and never restyles one.
//
// Mapping (contract FieldOverride): radio → Seg · toggle → Switch ·
// boolean → CheckRow · multichoice → CheckList · select → Select ·
// text/url/number/date/time → Input · textarea → Textarea · richtext and the
// `body` field → the host's body slot, else LiteEditor · datetime → date +
// time · duration → a Seg of lengths with Other · timezone → Select ·
// a `media` slot (cover_image_url, banners) → MediaField over the host's
// picker · `pictures` → PicturesField (several, in order) · `credits` →
// CreditRows · custom → the spec's own render · sessions → nothing (a kind's
// planner draws it) · the `title` field → the headline Title.
//
// The override merges over the cms-ui spec. With `value`/`onChange` the
// control is VIRTUAL (bound to nothing in answers); with `input` set, the
// name need not exist in cms-ui. The extra keys below are the shell's own.
// ============================================================================

/** Override keys the shell reads beyond the contract's FieldOverride. */
export interface ShellFieldOverride extends FieldOverride {
  /** The section heading is the visible label: keep this one as the control's accessible name only. */
  hideLabel?: boolean;
  /** Same as hideLabel (the shell's own spelling). */
  labelHidden?: boolean;
  /** 'sub' draws the label at 13/600 (fields inside a section). */
  size?: 'section' | 'sub';
  inlineHint?: string;
  icon?: FormIconName;
  width?: number | string;
  prefix?: string;
  suffix?: string;
  /** Pick a control the input type alone does not name. `pictures` and `credits` are also picked by those field names. */
  control?: 'title' | 'tags' | 'people' | 'media' | 'lite' | 'textarea' | 'select' | 'seg' | 'pictures' | 'credits';
  /** Switch: the line after the label ("Every week on Thursday, 8 sessions"). */
  summary?: string;
  /** CheckRow: the label in the label weight, and a second line. */
  strong?: boolean;
  sub?: string;
  /** CheckRow: beside the label, outside it ("Edit wording"). */
  after?: React.ReactNode;
  /** Set by the series: faded, with a way to change it for this one. */
  locked?: FieldLock;
  disabled?: boolean;
  people?: { selfId?: string | null; fixed?: string[]; max?: number; allowFree?: boolean };
  media?: { variant?: 'cover' | 'drop'; aspect?: string; accept?: string; altField?: string; focalField?: string };
  /** PicturesField: the first picture's proportion, its tag ("On cards"), a cap, the file types. */
  pictures?: { aspect?: string; firstTag?: string; max?: number; accept?: string; focal?: boolean };
  /** CreditRows: people credited by account (default: the context's hostCandidates), the roles, the add label, a cap, typed names. */
  credits?: { people?: PersonOption[]; roles?: SelectOption[]; selfId?: string | null; addLabel?: string; max?: number; allowFree?: boolean };
  /** Duration: the minutes offered before "Other". */
  durations?: number[];
  /** Seg/CheckList: lay out in a row; Seg on the page ground. */
  ground?: 'bg';
  rows?: number;
}

export interface FieldRenderContext {
  answers: Answers;
  patch: (fields: Partial<Answers>) => void;
  /** The issues SHOWN now (the shell has applied validationAttempted). */
  issues: FormIssue[];
  fromPreset: Record<string, string>;
  tier: FormTier;
  host: FormHost;
  ctx: FormContext;
  /** cms-ui specs for the current code kind, by field name. */
  specs: Record<string, ContentFieldSpec>;
  scope?: string;
  /** "Edit in full editor", for a body the lite editor can't keep. */
  fullEditorHref?: string | null;
  /** Label size when the override names none: 'sub' inside a section the shell has headed. */
  defaultSize?: 'section' | 'sub';
  /** Which editor the body field gets (the kind's layout.body.editor); default toolbar. */
  bodyEditor?: 'blocks' | 'toolbar';
}

/** The blocks editor a focus host passes as `slots.blocks` (the Studio essay Canvas): HTML in, HTML (+ its document) out. */
export type BlocksSlot = (props: {
  value: string;
  doc: unknown;
  onChange: (html: string, doc?: unknown) => void;
  tier?: 'quick' | 'full';
}) => React.ReactNode;

/** The toolbar editor a host passes as `slots.body` (cms-ui ContentComposerSlots['body']: RichTextEditor). */
export type BodySlot = (props: { value: string; onChange: (html: string) => void; tier?: 'quick' | 'full' }) => React.ReactNode;

const SPEC_KEYS = ['input', 'options', 'label', 'hint', 'placeholder', 'inline', 'required', 'min', 'max', 'step', 'dependsOn', 'slot', 'previewField', 'render'] as const;

function mergeSpec(name: string, base: ContentFieldSpec | undefined, o: ShellFieldOverride | undefined): ContentFieldSpec | null {
  if (!base && !o?.input && o?.control !== 'pictures' && o?.control !== 'credits') return null;
  const spec: Record<string, unknown> = { ...(base ?? { name, label: name, input: 'text' }) };
  if (o) for (const k of SPEC_KEYS) if (k in o && o[k] !== undefined) spec[k] = o[k];
  spec.name = name;
  return spec as unknown as ContentFieldSpec;
}

function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

const ZONES = [
  'America/Vancouver', 'America/Los_Angeles', 'America/Edmonton', 'America/Denver', 'America/Winnipeg', 'America/Chicago',
  'America/Toronto', 'America/New_York', 'America/Halifax', 'America/St_Johns', 'Europe/London', 'Europe/Dublin',
  'Europe/Lisbon', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome', 'Europe/Amsterdam', 'Europe/Athens',
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland', 'UTC',
];
const zoneLabel = (z: string) => z.split('/').pop()!.replace(/_/g, ' ');

const DURATIONS = [60, 90, 120, 180];
function durationLabel(m: number): string {
  if (m % 60 === 0) return `${m / 60}h`;
  if (m % 60 === 30) return `${Math.floor(m / 60) || ''}½h`;
  return `${m} min`;
}

/** The problem this field shows: the worst shown issue naming it; the message only on the issue's first field. */
function problemFor(name: string, issues: FormIssue[]): FieldProblem | null {
  const mine = issues.filter((i) => i.fields.includes(name));
  const worst = mine.find((i) => i.severity === 'block') ?? mine[0];
  if (!worst) return null;
  return { tone: worst.severity === 'block' ? 'error' : 'warning', message: worst.fields[0] === name ? worst.message : null };
}

/** Draw one field by name. Returns null when the field is hidden by its dependsOn or unknown. */
export function renderField(name: string, override: ShellFieldOverride | undefined, rc: FieldRenderContext): React.ReactNode {
  const spec = mergeSpec(name, rc.specs[name], override);
  if (!spec) return null;
  if (!fieldDependencySatisfied(spec.dependsOn, rc.answers)) return null;
  return <FieldRenderer key={name} name={name} spec={spec} override={override} rc={rc} />;
}

function FieldRenderer({ name, spec, override: o = {}, rc }: { name: string; spec: ContentFieldSpec; override?: ShellFieldOverride; rc: FieldRenderContext }) {
  const virtual = 'value' in o || 'onChange' in o;
  const value = virtual ? o.value : readAnswer(rc.answers, name);
  const onChange = (v: unknown) => {
    if (virtual) o.onChange?.(v);
    else rc.patch({ [name]: v });
  };
  const id = fieldId(name, rc.scope);
  const problem = problemFor(name, rc.issues);
  const fromPreset = virtual ? null : rc.fromPreset[name] ?? null;
  const tone = problem?.tone ?? null;
  const locked = o.locked ?? null;
  const disabled = o.disabled || Boolean(locked);
  const control = o.control;
  const input = spec.input;
  // A checkbox's hint is its second line, inside the label (design: "Where it lives. Change it under Goes on.").
  const hintBelow = input === 'boolean' && !control ? undefined : spec.hint;
  const aria = fieldAria({ id, hint: hintBelow, problem, fromPreset });
  const hidden = o.hideLabel ?? o.labelHidden;

  const frame = (
    child: React.ReactNode,
    extra: { labelAsText?: boolean; labelHidden?: boolean; hint?: React.ReactNode | null; inlineHint?: React.ReactNode; selfLabelled?: boolean } = {}
  ) => (
    <Field
      id={id}
      name={name}
      scope={rc.scope}
      label={extra.selfLabelled ? undefined : spec.label}
      labelHidden={extra.labelHidden ?? hidden}
      labelAsText={extra.labelAsText}
      size={o.size ?? rc.defaultSize}
      inlineHint={extra.inlineHint ?? o.inlineHint}
      hint={extra.hint === null ? undefined : extra.hint ?? hintBelow}
      problem={problem}
      fromPreset={fromPreset}
      locked={locked}
      required={spec.required}
    >
      {child}
    </Field>
  );

  // ── the headline ──
  if (control === 'title' || (name === 'title' && !control && (input === 'text' || !input))) {
    return frame(
      <Title
        id={id}
        value={str(value)}
        onChange={onChange}
        placeholder={o.placeholder ?? 'Title'}
        label={spec.label || 'Title'}
        tier={rc.tier}
        describedBy={aria['aria-describedby']}
        invalid={tone === 'error'}
        disabled={disabled}
      />,
      { labelHidden: true }
    );
  }

  // ── rich text: the host's editor when it bundles one, else the lite editor ──
  // focus + blocks: slots.blocks (the essay Canvas), else slots.body; toolbar: slots.body;
  // quick compose, or a host with neither: the LiteEditor (no tiptap in ./forms).
  if (control === 'lite' || input === 'richtext' || (name === 'body' && input === 'custom' && !spec.render)) {
    const tierProp = rc.tier === 'quick' ? 'quick' : 'full';
    const blocks = rc.tier === 'focus' && rc.bodyEditor === 'blocks' && control !== 'lite' ? (rc.host.slots?.blocks as BlocksSlot | undefined) : undefined;
    const slot = rc.tier === 'focus' && control !== 'lite' ? (rc.host.slots?.body as BodySlot | undefined) : undefined;
    const editor =
      typeof blocks === 'function' ? (
        <div className="frm-blocks">
        {blocks({
          value: str(value),
          doc: virtual ? null : readAnswer(rc.answers, `${name}_doc`) ?? null,
          onChange: (html, doc) => (virtual ? onChange(html) : rc.patch(doc === undefined ? { [name]: html } : { [name]: html, [`${name}_doc`]: doc })),
          tier: tierProp,
        })}
        </div>
      ) : typeof slot === 'function' ? (
        slot({ value: str(value), onChange: (h) => onChange(h), tier: tierProp })
      ) : (
        <LiteEditor
          id={id}
          value={str(value)}
          onChange={(h) => onChange(h)}
          placeholder={o.placeholder ?? spec.placeholder}
          label={spec.label}
          tier={rc.tier}
          describedBy={aria['aria-describedby']}
          tone={tone}
          disabled={disabled}
          fullEditor={rc.fullEditorHref ? { href: rc.fullEditorHref } : null}
        />
      );
    return frame(editor, { labelAsText: typeof blocks === 'function' || typeof slot === 'function' });
  }

  // ── several pictures, in order (artwork): the first is the card picture ──
  if (control === 'pictures' || (name === 'pictures' && !control)) {
    const pc = o.pictures ?? {};
    // The design's hint sits beside the label: "Drag to reorder. The first is the one on cards."
    const beside = o.inlineHint ?? spec.hint ?? `Drag to reorder. The first is the one ${(pc.firstTag ?? 'On cards').toLowerCase()}.`;
    return frame(
      <PicturesField
        id={id}
        value={value}
        onChange={onChange}
        slot={(rc.host.slots?.media as MediaSlot | undefined) ?? null}
        label={spec.label}
        accept={pc.accept}
        aspect={pc.aspect}
        firstTag={pc.firstTag}
        max={pc.max}
        focal={pc.focal !== false}
        describedBy={problem?.message ? `${id}-msg` : undefined}
        tone={tone}
        disabled={disabled}
      />,
      { labelAsText: true, hint: null, inlineHint: beside }
    );
  }

  // ── credits: role + person or name, per row ──
  if (control === 'credits' || (name === 'credits' && !control)) {
    const cr = o.credits ?? {};
    const candidates = (rc.ctx.fields.hostCandidates as Array<{ userId: string; displayName: string }> | undefined) ?? [];
    const people: PersonOption[] = cr.people ?? candidates.map((h) => ({ value: h.userId, label: h.displayName }));
    return frame(
      <CreditRows
        id={id}
        value={value}
        onChange={onChange}
        people={people}
        roles={cr.roles}
        selfId={cr.selfId}
        addLabel={cr.addLabel}
        max={cr.max}
        allowFree={cr.allowFree !== false}
        describedBy={aria['aria-describedby']}
        tone={tone}
        disabled={disabled}
      />,
      { labelAsText: true }
    );
  }

  // ── a picture ──
  if (control === 'media' || spec.slot === 'media' || name === 'cover_image_url') {
    const m = o.media ?? {};
    const altKey = m.altField;
    const focalKey = m.focalField;
    return frame(
      <MediaField
        id={id}
        value={value}
        onChange={onChange}
        slot={(rc.host.slots?.media as MediaSlot | undefined) ?? null}
        label={spec.label}
        hint={spec.hint}
        accept={m.accept}
        variant={m.variant}
        aspect={m.aspect}
        alt={altKey ? { value: str(readAnswer(rc.answers, altKey)), onChange: (v) => rc.patch({ [altKey]: v }) } : null}
        focal={focalKey ? { value: readAnswer(rc.answers, focalKey), onChange: (v: number | Focal) => rc.patch({ [focalKey]: v }) } : null}
        describedBy={aria['aria-describedby']}
        tone={tone}
        disabled={disabled}
      />,
      { labelAsText: true }
    );
  }

  if (control === 'tags') {
    return frame(<TagInput id={id} value={value} onChange={onChange} placeholder={o.placeholder ?? spec.placeholder} describedBy={aria['aria-describedby']} tone={tone} disabled={disabled} />);
  }
  if (control === 'people') {
    const p = o.people ?? {};
    const opts: PersonOption[] = (spec.options ?? []).map((x) => ({ value: x.value, label: x.label, note: (x as { hint?: string }).hint }));
    return frame(
      <PeopleInput
        id={id}
        value={value}
        onChange={onChange}
        options={opts}
        selfId={p.selfId}
        fixed={p.fixed}
        max={p.max}
        allowFree={p.allowFree}
        placeholder={o.placeholder ?? spec.placeholder}
        describedBy={aria['aria-describedby']}
        tone={tone}
        disabled={disabled}
      />
    );
  }

  switch (control === 'seg' ? 'radio' : control === 'select' ? 'select' : control === 'textarea' ? 'textarea' : input) {
    case 'radio':
      return frame(
        <Seg
          name={id}
          id={id}
          value={str(value)}
          options={(spec.options ?? []).map((x) => ({ value: x.value, label: x.label, icon: (x as { icon?: FormIconName }).icon, title: (x as { hint?: string }).hint }))}
          onChange={onChange}
          labelledBy={`${id}-label`}
          describedBy={aria['aria-describedby']}
          ground={o.ground}
          tone={tone}
          disabled={disabled}
        />,
        { labelAsText: true }
      );
    case 'toggle':
      return frame(
        <Switch id={id} checked={Boolean(value)} onChange={onChange} label={spec.label} summary={o.summary ?? spec.placeholder} describedBy={aria['aria-describedby']} disabled={disabled} />,
        { selfLabelled: true }
      );
    case 'boolean':
      return frame(
        <CheckRow id={id} checked={Boolean(value)} onChange={onChange} label={spec.label} sub={o.sub ?? spec.hint ?? spec.placeholder} strong={o.strong} after={o.after} describedBy={aria['aria-describedby']} disabled={disabled} />,
        { selfLabelled: true }
      );
    case 'multichoice':
      return frame(
        <CheckList
          id={id}
          value={value}
          options={(spec.options ?? []).map((x) => ({ value: x.value, label: x.label, hint: (x as { hint?: string }).hint }))}
          onChange={onChange}
          labelledBy={`${id}-label`}
          describedBy={aria['aria-describedby']}
          inline={spec.inline}
          disabled={disabled}
        />,
        { labelAsText: true }
      );
    case 'select': {
      // An empty choice only where a kind asks for one (its own placeholder: "Nobody yet"),
      // or when nothing is chosen yet, so the first option never looks picked.
      const emptyLabel = 'placeholder' in o && o.placeholder !== undefined ? o.placeholder : !str(value) ? spec.placeholder ?? 'Choose…' : undefined;
      return frame(
        <Select
          id={id}
          icon={o.icon}
          width={o.width}
          value={str(value)}
          options={spec.options ?? []}
          placeholder={spec.required && str(value) ? undefined : emptyLabel}
          tone={tone}
          locked={Boolean(locked)}
          disabled={disabled}
          {...aria}
          onChange={(e) => onChange(e.target.value || null)}
        />
      );
    }
    case 'timezone': {
      const current = str(value);
      const list = current && !ZONES.includes(current) ? [current, ...ZONES] : ZONES;
      return frame(
        <Select
          id={id}
          icon={o.icon}
          width={o.width}
          value={current}
          options={list.map((z) => ({ value: z, label: zoneLabel(z) }))}
          placeholder={rc.ctx.timeZone ? `Same as the site (${zoneLabel(rc.ctx.timeZone)})` : 'Choose a zone'}
          tone={tone}
          disabled={disabled}
          {...aria}
          onChange={(e) => onChange(e.target.value || null)}
        />
      );
    }
    case 'textarea':
      return frame(
        <Textarea
          id={id}
          value={str(value)}
          placeholder={o.placeholder ?? spec.placeholder}
          rows={o.rows ?? 3}
          tone={tone}
          disabled={disabled}
          {...aria}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'datetime':
      return frame(
        <DateTimeInput
          id={id}
          value={value}
          onChange={onChange}
          tone={tone}
          locked={Boolean(locked)}
          disabled={disabled}
          describedBy={aria['aria-describedby']}
          invalid={tone === 'error'}
          label={spec.label}
        />
      );
    case 'duration': {
      const list = o.durations ?? DURATIONS;
      const minutes = typeof value === 'number' ? value : value ? Number(value) : null;
      const isOther = minutes !== null && !list.includes(minutes);
      return frame(
        <div className="frm-row" style={{ alignItems: 'center', gap: 10 }}>
          <Seg
            name={id}
            id={id}
            value={isOther ? 'other' : minutes !== null ? String(minutes) : null}
            options={[...list.map((m) => ({ value: String(m), label: durationLabel(m) })), { value: 'other', label: 'Other' }]}
            onChange={(v) => onChange(v === 'other' ? (minutes && !list.includes(minutes) ? minutes : 45) : Number(v))}
            labelledBy={`${id}-label`}
            describedBy={aria['aria-describedby']}
            tone={tone}
            disabled={disabled}
          />
          {isOther && (
            <Input
              id={`${id}-min`}
              type="number"
              min={5}
              step={5}
              width={110}
              suffix="min"
              value={minutes ?? ''}
              aria-label={`${spec.label}, in minutes`}
              disabled={disabled}
              onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
            />
          )}
        </div>,
        { labelAsText: true }
      );
    }
    case 'focal': {
      const pct = typeof value === 'number' ? value : value ? Number(value) : 50;
      return frame(
        <input
          id={id}
          type="range"
          min={0}
          max={100}
          value={pct}
          aria-valuetext={`${pct}% from the top`}
          style={{ accentColor: 'var(--frm-accent)' }}
          disabled={disabled}
          {...aria}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      );
    }
    case 'custom':
      return spec.render ? frame(<>{spec.render({ value, onChange, id, field: spec as WizardFieldSpec })}</>, { labelAsText: true }) : null;
    case 'sessions':
      return null;
    case 'number':
      return frame(
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          icon={o.icon}
          width={o.width}
          prefix={o.prefix}
          suffix={o.suffix}
          min={spec.min}
          max={spec.max}
          step={spec.step}
          placeholder={o.placeholder ?? spec.placeholder}
          value={value === null || value === undefined ? '' : String(value)}
          tone={tone}
          locked={Boolean(locked)}
          disabled={disabled}
          {...aria}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
      );
    case 'date':
    case 'time':
    case 'url':
    case 'color':
    case 'text':
    default: {
      const type = input === 'date' || input === 'time' || input === 'url' || input === 'color' ? input : 'text';
      const icon = o.icon ?? (input === 'date' ? 'date' : input === 'time' ? 'clock' : input === 'url' ? 'link' : undefined);
      return frame(
        <Input
          id={id}
          type={type}
          inputMode={type === 'url' ? 'url' : undefined}
          icon={icon}
          width={o.width}
          prefix={o.prefix}
          suffix={o.suffix}
          placeholder={o.placeholder ?? spec.placeholder}
          value={str(value)}
          tone={tone}
          locked={Boolean(locked)}
          disabled={disabled}
          {...aria}
          onChange={(e) => onChange(type === 'date' || type === 'time' ? e.target.value || null : e.target.value)}
        />
      );
    }
  }
}
