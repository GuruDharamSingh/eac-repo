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
import { Canvas, type CanvasUpload, type ThreadCardSearchHit } from '@elkdonis/studio-forms/canvas';
import { StudioColumns, useNewRequest, useStudioFrame, type StudioExtension } from '../frame';
import { FormItemList, type FormListItem } from './item-list';
import { PieceSummaryGate } from '../summary/gate';
import {
  FormShell,
  PERSONAL_ORG,
  channelStoreOf,
  orderPresets,
  useFormState,
  useFormUi,
  type Answers,
  type BlocksSlot,
  type BodySlot,
  type FormActions,
  type FormContext,
  type FormHost,
  type FormKindSchema,
  type FormPreset,
  type FormTheme,
} from '@elkdonis/studio-forms';

/** The essay Canvas as the `blocks` slot: HTML in, rendered HTML and the document out (body + body_doc). */
export function canvasBlocksSlot(opts: { search?: (kind: string, q: string) => Promise<ThreadCardSearchHit[]>; upload?: CanvasUpload; placeholder?: string } = {}): BlocksSlot {
  const search = opts.search ?? (async () => []);
  const BlocksBody: BlocksSlot = ({ value, doc, onChange, omit }) => (
    <Canvas
      doc={(doc as EssayDoc | null) ?? null}
      html={doc ? undefined : value}
      onChange={(d) => onChange(renderEssayHtml(d), d)}
      card={{ search }}
      upload={opts.upload}
      placeholder={opts.placeholder ?? 'Start writing. Add a picture, a pull quote or a card.'}
      omit={omit}
    />
  );
  return BlocksBody;
}

/** cms-ui's RichTextEditor as the `body` slot (a meeting's Description in focus mode). */
export function richTextBodySlot(placeholder = 'What happens, who it is for, what to bring.'): BodySlot {
  const Body: BodySlot = ({ value, onChange }) => <RichTextEditor value={value} onChange={onChange} toolbar="full" placeholder={placeholder} />;
  return Body;
}

export interface FormExtensionOptions {
  /** The Studio kind id this replaces or adds. */
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
  /** Used instead of `theme` while the Studio frame is dark (2026-11-11). */
  themeDark?: FormTheme | null;
  /**
   * The kind's items for the Studio column's "All pieces" (2026-11-11, canvas R1). Given, the kind
   * draws the Studio's left column: its items under "All pieces", its rail under "This piece".
   * Unset, the form keeps its own rail and no column (as before).
   */
  items?: (orgId: string) => Promise<FormListItem[]>;
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
  const startNew = React.useCallback(() => {
    setOpenId(null);
    setGeneration((g) => g + 1);
  }, []);
  useNewRequest(startNew);

  // The column (when the host lists items): the list, and a host element the rail is drawn into.
  const [items, setItems] = React.useState<FormListItem[] | null>(null);
  const [listVersion, setListVersion] = React.useState(0);
  const [currentId, setCurrentId] = React.useState<string | null>(o.initialId ?? null);
  const [railHost, setRailHost] = React.useState<HTMLDivElement | null>(null);
  const listItems = o.items;
  React.useEffect(() => {
    if (!listItems) return;
    let live = true;
    listItems(frame.orgId)
      .then((l) => live && setItems(l))
      .catch(() => live && setItems([]));
    return () => {
      live = false;
    };
  }, [listItems, frame.orgId, listVersion]);
  // A first save or a publish changes the list.
  const onRecord = React.useCallback((id: string | null) => {
    setCurrentId(id);
    setListVersion((v) => v + 1);
  }, []);

  const body = !fields ? (
    <p className="frm-loading">Loading…</p>
  ) : fields.canEdit === false ? (
    <p className="frm-loading">{typeof fields.reason === 'string' ? fields.reason : 'You can’t make this here.'}</p>
  ) : (
    <FormExtensionBody
      key={`${frame.orgId}:${generation}:${openId ?? 'new'}`}
      {...o}
      fields={fields}
      openId={openId}
      railTarget={listItems ? railHost : undefined}
      onRecord={listItems ? onRecord : undefined}
    />
  );
  if (!listItems) return body;
  return (
    <StudioColumns
      drawer={
        <FormItemList
          noun={o.listLabel ?? o.label}
          items={items}
          currentId={currentId}
          query={frame.query}
          onOpen={(id) => {
            setOpenId(id);
            setCurrentId(id);
            setGeneration((g) => g + 1);
          }}
          onNew={startNew}
        />
      }
      main={body}
      settings={<div className="studio-railhost" ref={setRailHost} />}
    />
  );
}

function FormExtensionBody(
  o: FormExtensionOptions & {
    fields: Record<string, unknown>;
    openId: string | null;
    /** The column's "This piece" element: the rail goes there. */
    railTarget?: HTMLElement | null;
    /** The saved record's id when it changes (first save) and on publish, so the list refreshes. */
    onRecord?: (id: string | null) => void;
  }
) {
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

  // Tell the shell which saved item is open, so its bar can link to the item's board in Channel
  // (2026-11-11). Kinds Channel does not cover report nothing.
  const store = channelStoreOf(o.schema.id);
  const setPiece = frame.setPiece;
  React.useEffect(() => {
    if (!setPiece) return;
    setPiece(store && form.state.id ? { store, id: form.state.id, orgId: store === 'thread' && orgId !== PERSONAL_ORG ? orgId : null } : null);
    return () => setPiece(null);
  }, [setPiece, store, form.state.id, orgId]);

  // The column's list follows the first save and a publish.
  const onRecord = o.onRecord;
  React.useEffect(() => {
    if (form.state.id) onRecord?.(form.state.id);
  }, [onRecord, form.state.id, form.state.publishedAt]);

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

  // A piece opened published shows its summary first (canvas C, 2026-11-14); off unless the host provides PieceSummaryHostContext.
  return (
    <PieceSummaryGate openId={o.openId} id={form.state.id} publishedAt={form.state.publishedAt} record={form.state.record} answers={form.state.answers} store={store} orgId={orgId} orgName={orgName} schema={o.schema} ctx={ctx}>
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
      theme={(frame.dark && o.themeDark) || o.theme || null}
      presets={presets}
      kinds={[o.schema.id]}
      railTarget={o.railTarget}
    />
    </PieceSummaryGate>
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
export type { FormListItem };
