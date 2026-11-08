'use client';

import * as React from 'react';
import { StudioFrameContext, StudioTopActions, StudioTopStatus } from '../../frame';
import type {
  Answers,
  FormContext,
  FormHost,
  FormKindId,
  FormKindSchema,
  FormPreset,
  FormSection,
  FormState,
  FormTheme,
  FormTier,
  FormUiState,
} from '../contract';
import { Seg } from '../fields/Seg';
import { PreviewFrame } from '../preview/PreviewFrame';
import { Icon, FormRoot } from '../theme/context';
import { AfterPublish } from './AfterPublish';
import { AlertSummary, goToField } from './AlertSummary';
import { PresetSlot, Rail } from './Rail';
import { FormSections, shownIssues } from './Sections';
import { KIND_NOUN, clockIn } from './ui';

// ============================================================================
// FormShell: the focus-mode shell of the publication forms (design §1, §7–9).
//
//   top bar   ← Studio · kind label ▾ · Draft/Published · saved line · actions
//   body      rail (Start from, index, readiness) · form (≤600px) · preview
//
// It renders ANY FormKindSchema: sections from cms-ui groups/fields, plus the
// kind's own components (FormSection.render) with SectionProps. It owns no
// form state: `state` comes from useFormState (state.ts), `ui` from the host
// (or useFormUi), and every change goes out through `on`.
//
// Inside StudioShell (a StudioFrameContext above), the shell's own bar keeps
// "← Studio", the kind switch and "Making as"; this puts its status in
// StudioTopStatus and its buttons in StudioTopActions. Outside it, the shell
// draws its own top bar. At phone width (the shell's container ≤ 760px) both
// give way to the phone bars: × · label over saved line · Publish, a
// Form | Preview seg, and Save draft | Schedule at the bottom; both sticky.
//
// Layout switch (README "Open decision"; owner default 2a = toggle):
//   split   rail · form · preview, always
//   toggle  rail · form, and the preview when the top-bar Preview is on
//   rail    the rail's Sections | Preview seg swaps the index for the preview
// ============================================================================

export interface FormShellHandlers {
  patch: (fields: Partial<Answers>) => void;
  toggleSection: (id: string, open?: boolean) => void;
  ui: (patch: Partial<FormUiState>) => void;
  saveDraft: () => unknown;
  /** useFormState().publish: saves the draft, publishes only when nothing blocks. */
  publish: () => unknown;
  applyPreset?: (preset: FormPreset) => void;
  /** "Schedule…". Without it, the button opens the kind's `schedule` section if it has one, else it is not drawn. */
  schedule?: () => void;
  unpublish?: () => void;
  /** The caret's kind switch (standalone; in the Studio the shell's own switch is used). */
  switchKind?: (kind: FormKindId) => void;
  /** "Make another" after publishing. */
  makeAnother?: (o: { kind: FormKindId; withSettings: boolean }) => void;
  /** The phone's ×; default is a link to the Studio. */
  close?: () => void;
}

export interface FormShellProps {
  schema: FormKindSchema;
  state: FormState;
  ui: FormUiState;
  on: FormShellHandlers;
  host: FormHost;
  ctx: FormContext;
  theme?: FormTheme | null;
  tier?: FormTier;
  /** The "Start from" list (presets.ts orderPresets). Empty hides the slot. */
  presets?: FormPreset[];
  /** Applied once on a new item; inside the Studio the frame's `?preset=` wins. */
  initialPreset?: string | null;
  /** The kinds the caret and "Make another" offer; default: the kinds the host binds actions for. */
  kinds?: FormKindId[];
  /** Keeps ids unique when a page draws two forms. */
  scope?: string;
  className?: string;
}

function savedLine(state: FormState, clock: (iso: string) => string): { text: string; tone?: 'error' } {
  if (state.publishedAt) return { text: `Live since ${clock(state.publishedAt)}` };
  if (state.saveStatus === 'saving') return { text: 'Saving…' };
  if (state.saveStatus === 'error') return { text: 'Not saved. Try again.', tone: 'error' };
  if (state.savedAt) return { text: `Draft saved ${clock(state.savedAt)}` };
  return { text: 'Not saved yet' };
}

function KindMenu({ current, kinds, onPick, scope }: { current: FormKindId; kinds: FormKindId[]; onPick: (k: FormKindId) => void; scope: string }) {
  const [open, setOpen] = React.useState(false);
  const wrap = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  const menuId = `frm-${scope}kinds`;
  return (
    <span ref={wrap} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        className="frm-top-caret"
        aria-label="Make something else"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="caret" size={14} />
      </button>
      {open && (
        <div className="frm-menu" role="menu" id={menuId}>
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              role="menuitem"
              className="frm-menu-item"
              aria-current={k === current || undefined}
              onClick={() => {
                setOpen(false);
                if (k !== current) onPick(k);
              }}
            >
              {`New ${KIND_NOUN[k].toLowerCase()}`}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

export function FormShell({ schema, state, ui, on, host, ctx, theme, tier = 'focus', presets = [], initialPreset, kinds, scope = '', className }: FormShellProps) {
  const frame = React.useContext(StudioFrameContext);
  const clock = React.useMemo(() => clockIn(ctx.timeZone), [ctx.timeZone]);
  const offered = kinds ?? (Object.keys(host.actions) as FormKindId[]);
  const published = Boolean(state.publishedAt);
  const stage = ui.stage === 'published' && published ? 'published' : 'edit';
  const codeKind = schema.codeKind(state.answers);
  const previewKind: FormKindId | 'series' = codeKind === 'series' ? 'series' : schema.id;
  const studioHome = host.studioHref({ kind: '' });
  const label = schema.label(state.answers);
  const saved = savedLine(state, clock);
  const issues = shownIssues(state);
  const hasScheduleSection = schema.sections.some((s) => s.id === 'schedule');
  const canSchedule = Boolean(on.schedule) || hasScheduleSection;

  // "Publishing…" and "Saving…" on the button that was pressed, while the save runs.
  const [pending, setPending] = React.useState<null | 'draft' | 'publish'>(null);
  React.useEffect(() => {
    if (state.saveStatus !== 'saving') setPending(null);
  }, [state.saveStatus]);

  // ?preset= (the Studio frame) or the host's initial preset, once, on a new item.
  const presetApplied = React.useRef(false);
  React.useEffect(() => {
    if (presetApplied.current) return;
    presetApplied.current = true;
    const want = frame?.preset ?? initialPreset;
    if (!want || state.id || state.presetId || !on.applyPreset) return;
    const p = presets.find((x) => x.id === want);
    if (p) on.applyPreset(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = (s: FormSection) => {
    if (s.tier === 'more' && !state.openSections.includes(s.id)) on.toggleSection(s.id, true);
    goToField({ fields: [], section: s.id }, scope);
  };

  const publish = async () => {
    setPending('publish');
    try {
      const r = await on.publish();
      if (r === 'published') on.ui({ stage: 'published', mobileTab: 'form' });
      else if (r === 'blocked') requestAnimationFrame(() => document.getElementById(`frm-${scope}form-top`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    } finally {
      setPending(null);
    }
  };
  const saveDraft = async () => {
    setPending('draft');
    try {
      await on.saveDraft();
    } finally {
      setPending(null);
    }
  };
  const schedule = () => {
    if (on.schedule) return on.schedule();
    const s = schema.sections.find((x) => x.id === 'schedule');
    if (s) goTo(s);
  };

  const busy = state.saveStatus === 'saving';
  const publishLabel = published ? 'Save changes' : 'Publish';
  const publishBtn = (extra?: string) => (
    <button
      type="button"
      className={`frm-btn frm-btn--primary${extra ? ` ${extra}` : ''}`}
      data-busy={busy && pending === 'publish' ? '' : undefined}
      aria-busy={busy && pending === 'publish' ? true : undefined}
      onClick={publish}
    >
      {busy && pending === 'publish' ? (
        <>
          <Icon name="spinner" size={16} className="frm-spin" />
          {published ? 'Saving…' : 'Publishing…'}
        </>
      ) : (
        publishLabel
      )}
    </button>
  );
  const previewToggle =
    ui.layout === 'toggle' ? (
      <button
        type="button"
        className="frm-btn frm-btn--secondary frm-btn--toggle"
        aria-pressed={ui.previewOpen}
        onClick={() => on.ui({ previewOpen: !ui.previewOpen })}
      >
        <Icon name={ui.previewOpen ? 'preview' : 'previewOff'} size={16} />
        Preview
      </button>
    ) : null;

  const actions =
    stage === 'published' ? (
      <>
        {on.unpublish && (
          <button type="button" className="frm-btn frm-btn--ghost" onClick={on.unpublish}>
            Unpublish
          </button>
        )}
        <a className="frm-btn frm-btn--secondary" href={studioHome}>
          Back to Studio
        </a>
      </>
    ) : (
      <>
        {previewToggle}
        {published ? (
          on.unpublish && (
            <button type="button" className="frm-btn frm-btn--ghost" onClick={on.unpublish}>
              Unpublish
            </button>
          )
        ) : (
          <button type="button" className="frm-btn frm-btn--secondary" onClick={saveDraft} disabled={busy && pending === 'draft'}>
            {busy && pending === 'draft' ? 'Saving…' : 'Save draft'}
          </button>
        )}
        {canSchedule && !published && (
          <button type="button" className="frm-btn frm-btn--secondary" onClick={schedule}>
            <Icon name="clock" size={16} />
            Schedule…
          </button>
        )}
        {publishBtn()}
      </>
    );

  const tag = (
    <span className={`frm-tag ${published ? 'frm-tag--accent' : 'frm-tag--neutral'}`}>{published ? 'Published' : 'Draft'}</span>
  );
  const savedEl = (cls: string) => (
    <span className={cls} data-tone={saved.tone} aria-live="polite">
      {saved.text}
    </span>
  );

  const railSeg = (where: string) =>
    ui.layout === 'rail' ? (
      <Seg
        name={`frm-${scope}railseg-${where}`}
        ariaLabel="Show in the side column"
        full
        size="sm"
        ground={where === 'pv' ? 'bg' : undefined}
        value={ui.previewOpen ? 'preview' : 'sections'}
        options={[
          { value: 'sections', label: 'Sections' },
          { value: 'preview', label: 'Preview', icon: 'preview' },
        ]}
        onChange={(v) => on.ui({ previewOpen: v === 'preview' })}
      />
    ) : null;

  const before = (
    <>
      <span id={`frm-${scope}form-top`} />
      {presets.length > 0 && (
        <div className="frm-mstart">
          <span className="frm-mstart-label">Start from</span>
          <PresetSlot id={`frm-${scope}preset-m`} schema={schema} state={state} presets={presets} onApply={on.applyPreset} showNote={false} />
        </div>
      )}
      {state.validationAttempted && <AlertSummary issues={issues} saved={state.saveStatus === 'saved' || Boolean(state.savedAt)} scope={scope} onOpenSection={(id) => on.toggleSection(id, true)} />}
    </>
  );

  return (
    <FormRoot
      theme={theme}
      className={`frm-shell${className ? ` ${className}` : ''}`}
      data-layout={ui.layout}
      data-preview-open={ui.previewOpen ? '' : undefined}
      data-mobile-tab={ui.mobileTab}
      data-stage={stage}
      data-tier={tier}
    >
      {frame ? (
        <>
          <StudioTopStatus>
            <FormRoot theme={theme} as="span" className="frm--inline">
              {tag}
              {savedEl('frm-top-saved')}
            </FormRoot>
          </StudioTopStatus>
          <StudioTopActions>
            <FormRoot theme={theme} as="span" className="frm--inline frm--studio-actions">
              {actions}
            </FormRoot>
          </StudioTopActions>
        </>
      ) : (
        <header className="frm-top">
          <a className="frm-btn frm-btn--ghost frm-top-back" href={studioHome}>
            <Icon name="back" size={16} />
            Studio
          </a>
          <div className="frm-top-kind">
            <span className="frm-top-label">{label}</span>
            {on.switchKind && offered.length > 1 && <KindMenu current={schema.id} kinds={offered} onPick={on.switchKind} scope={scope} />}
            {tag}
            {savedEl('frm-top-saved')}
          </div>
          <div className="frm-top-actions">{actions}</div>
        </header>
      )}

      <div className="frm-mtop">
        <div className="frm-mtop-row">
          {on.close ? (
            <button type="button" className="frm-btn frm-btn--icon" aria-label="Close" onClick={on.close}>
              <Icon name="close" size={20} />
            </button>
          ) : (
            <a className="frm-btn frm-btn--icon" aria-label="Back to Studio" href={studioHome}>
              <Icon name="close" size={20} />
            </a>
          )}
          <div className="frm-mtop-title">
            <span className="frm-mtop-label">{label}</span>
            {savedEl('frm-mtop-saved')}
          </div>
          {stage === 'published' ? (
            <a className="frm-btn frm-btn--secondary" href={studioHome}>
              Done
            </a>
          ) : (
            publishBtn()
          )}
        </div>
        <Seg
          name={`frm-${scope}mtab`}
          ariaLabel="Show"
          full
          value={ui.mobileTab}
          options={[
            { value: 'form', label: 'Form' },
            { value: 'preview', label: 'Preview' },
          ]}
          onChange={(v) => on.ui({ mobileTab: v === 'preview' ? 'preview' : 'form' })}
        />
      </div>

      <div className="frm-body">
        <Rail
          schema={schema}
          state={state}
          ctx={ctx}
          presets={presets}
          scope={scope}
          onApplyPreset={on.applyPreset}
          onGo={goTo}
          top={railSeg('rail')}
        />
        <div className="frm-main">
          {stage === 'published' ? (
            <AfterPublish
              schema={schema}
              state={state}
              host={host}
              ctx={ctx}
              kinds={offered}
              scope={scope}
              onKeepEditing={() => on.ui({ stage: 'edit' })}
              onMakeAnother={on.makeAnother}
            />
          ) : (
            <FormSections
              schema={schema}
              state={state}
              host={host}
              ctx={ctx}
              tier={tier}
              scope={scope}
              patch={on.patch}
              toggleSection={on.toggleSection}
              fullEditorHref={host.studioHref({ kind: schema.id, id: state.id ?? undefined, focus: true })}
              before={before}
            />
          )}
        </div>
        <PreviewFrame
          kind={previewKind}
          answers={state.answers}
          ctx={ctx}
          host={host}
          mode={ui.previewMode}
          onMode={(m) => on.ui({ previewMode: m })}
          published={stage === 'published'}
          onClose={ui.layout === 'toggle' ? () => on.ui({ previewOpen: false }) : undefined}
          top={railSeg('pv')}
          scope={scope}
        />
      </div>

      {stage === 'edit' && (
        <div className="frm-mbottom">
          {!published && (
            <button type="button" className="frm-btn frm-btn--secondary" onClick={saveDraft}>
              {busy && pending === 'draft' ? 'Saving…' : 'Save draft'}
            </button>
          )}
          {canSchedule && !published && (
            <button type="button" className="frm-btn frm-btn--secondary" onClick={schedule}>
              <Icon name="clock" size={16} />
              Schedule
            </button>
          )}
          {published && on.unpublish && (
            <button type="button" className="frm-btn frm-btn--secondary" onClick={on.unpublish}>
              Unpublish
            </button>
          )}
        </div>
      )}
    </FormRoot>
  );
}
