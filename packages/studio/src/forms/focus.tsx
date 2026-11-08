'use client';

// ============================================================================
// @elkdonis/studio/forms/focus: the full form inside the Studio (pass 1, bone).
//
// The heavy half of the forms: the essay Canvas as the Post body (`blocks`),
// cms-ui's RichTextEditor as a toolbar body, and `formExtension()`, which
// turns a kind into a StudioExtension the host registers next to its others
// (frame.tsx). StudioShell then draws its own top bar ("← Studio", kind switch,
// "Making as"); the form portals its Save/Publish into it and draws its own
// rail, form and preview below.
//
// Hosts only, never ./forms: this file imports tiptap.
// ============================================================================

import * as React from 'react';
import { RichTextEditor } from '@elkdonis/cms-ui/editor';
import { localTimeZone } from '@elkdonis/cms-ui/compose';
import { renderEssayHtml, type EssayDoc } from '@elkdonis/utils/essay';
import { Canvas, type CanvasUpload, type ThreadCardSearchHit } from '../canvas';
import { useNewRequest, useStudioFrame, type StudioExtension } from '../frame';
import type { Answers, FormActions, FormContext, FormHost, FormKindSchema, FormPreset, FormTheme } from './contract';
import type { BlocksSlot, BodySlot } from './fields/FieldRenderer';
import { orderPresets } from './presets';
import { FormShell, useFormUi } from './shell';
import { useFormState } from './state';

/** The essay Canvas as the `blocks` slot: HTML in, rendered HTML and the document out (body + body_doc). */
export function canvasBlocksSlot(opts: { search?: (kind: string, q: string) => Promise<ThreadCardSearchHit[]>; upload?: CanvasUpload; placeholder?: string } = {}): BlocksSlot {
  const search = opts.search ?? (async () => []);
  const BlocksBody: BlocksSlot = ({ value, doc, onChange }) => (
    <Canvas
      doc={(doc as EssayDoc | null) ?? null}
      html={doc ? undefined : value}
      onChange={(d) => onChange(renderEssayHtml(d), d)}
      card={{ search }}
      upload={opts.upload}
      placeholder={opts.placeholder ?? 'Start writing. Add a picture, a pull quote or a card.'}
    />
  );
  return BlocksBody;
}

/** cms-ui's RichTextEditor as the `body` slot (a gathering's Description in focus mode). */
export function richTextBodySlot(placeholder = 'What happens, who it is for, what to bring.'): BodySlot {
  const Body: BodySlot = ({ value, onChange }) => <RichTextEditor value={value} onChange={onChange} toolbar="full" placeholder={placeholder} />;
  return Body;
}

export interface FormExtensionOptions {
  /** The Studio kind id this replaces or adds ("meeting" for gatherings). */
  id: string;
  label: string;
  listLabel?: string;
  schema: FormKindSchema;
  actions: FormActions;
  /** Everything host-specific; `actions` is merged in. Built per acting org. */
  host: (orgId: string) => Omit<FormHost, 'actions'>;
  /** `?id=` on first open. */
  initialId?: string | null;
  /** Org/person presets from the host's store (pass 4); platform and "last settings" are added here. */
  presets?: (orgId: string) => Promise<FormPreset[]>;
  theme?: FormTheme | null;
}

/** A form kind as a StudioExtension: register it in the host's extensions list. */
export function formExtension(o: FormExtensionOptions): StudioExtension {
  return { id: o.id, label: o.label, listLabel: o.listLabel, render: () => <FormExtensionView {...o} /> };
}

function FormExtensionView(o: FormExtensionOptions) {
  const frame = useStudioFrame();
  const [fields, setFields] = React.useState<Record<string, unknown> | null>(null);
  const [generation, setGeneration] = React.useState(0);
  const [openId, setOpenId] = React.useState<string | null>(o.initialId ?? null);

  React.useEffect(() => {
    let live = true;
    setFields(null);
    o.actions
      .context(frame.orgId)
      .then((f) => live && setFields(f))
      .catch(() => live && setFields({}));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame.orgId]);

  // "New ▾" on this kind: a fresh, empty form.
  useNewRequest(() => {
    setOpenId(null);
    setGeneration((g) => g + 1);
  });

  if (!fields) return <p className="frm-loading">Loading…</p>;
  if (fields.canEdit === false) {
    return <p className="frm-loading">{typeof fields.reason === 'string' ? fields.reason : 'You can’t make this here.'}</p>;
  }
  return <FormExtensionBody key={`${frame.orgId}:${generation}:${openId ?? 'new'}`} {...o} fields={fields} openId={openId} />;
}

function FormExtensionBody(o: FormExtensionOptions & { fields: Record<string, unknown>; openId: string | null }) {
  const frame = useStudioFrame();
  const orgId = frame.orgId;
  const orgName = frame.orgs.find((x) => x.orgId === orgId)?.name ?? '';
  const ctx = React.useMemo<FormContext>(
    () => ({ orgId, orgName, fields: o.fields, timeZone: localTimeZone(), now: new Date() }),
    [orgId, orgName, o.fields]
  );
  const host = React.useMemo<FormHost>(() => ({ ...o.host(orgId), actions: { [o.schema.id]: o.actions } }), [o, orgId]);
  const form = useFormState({ schema: o.schema, ctx, orgId, actions: o.actions, onPublished: (r) => host.onPublished?.(o.schema.id, r) });
  const [ui, setUi] = useFormUi();
  const [presets, setPresets] = React.useState<FormPreset[]>([]);
  const setError = frame.setError;

  // An existing item: load it once.
  React.useEffect(() => {
    if (!o.openId || !o.actions.load) return;
    let live = true;
    o.actions
      .load(o.openId)
      .then((r) => {
        if (!live) return;
        if (!r) {
          setError('That could not be opened.');
          return;
        }
        form.dispatch({ type: 'load', answers: r.answers, id: o.openId!, record: r.record, publishedAt: publishedAtOf(r.record) });
      })
      .catch(() => live && setError('That could not be opened.'));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.openId]);

  // "Start from…": the host's presets, the last one's settings, the platform's.
  React.useEffect(() => {
    let live = true;
    Promise.all([o.presets?.(orgId).catch(() => []) ?? Promise.resolve([]), o.actions.lastSettings?.(orgId, o.schema.id).catch(() => null) ?? Promise.resolve(null)]).then(
      ([given, last]) => live && setPresets(orderPresets(o.schema.id, given as FormPreset[], last as FormPreset | null))
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  return (
    <FormShell
      schema={o.schema}
      state={form.state}
      ui={ui}
      on={{
        patch: form.patch,
        toggleSection: form.toggleSection,
        ui: setUi,
        saveDraft: form.saveDraft,
        publish: form.publish,
        applyPreset: form.applyPreset,
      }}
      host={host}
      ctx={ctx}
      theme={o.theme ?? null}
      presets={presets}
      kinds={[o.schema.id]}
    />
  );
}

function publishedAtOf(record: unknown): string | null {
  if (record && typeof record === 'object') {
    const r = record as { status?: unknown; publishedAt?: unknown };
    if (r.status === 'published' && typeof r.publishedAt === 'string') return r.publishedAt;
  }
  return null;
}

export type { Answers };
