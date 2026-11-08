"use client";

import * as React from "react";
import type { StudioExtension } from "@elkdonis/studio";
import {
  StudioColumns,
  StudioTopActions,
  StudioTopStatus,
  useNewRequest,
  useStudioFrame,
} from "@elkdonis/studio/frame";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import { MediaPicker } from "@elkdonis/cms-ui/files";
import { blankService, type ServiceDraft, type ServiceSummary } from "./service-types";

// ============================================================================
// Services, as a Studio kind (round 4, 2026-11-07). packages/studio lists
// `service` as not ready; a host may still register an extension under the
// id, and the shell then lists it in the kind switch and in "New ▾"
// (StudioShell: a kind with an extension is never disabled). So this is the
// whole Services kind, in this app, through the frame.tsx contract only.
//
// Fields are the site's service schema (lib/cms/schema.ts serviceFormSchema):
// title, line under it, card summary, description, price and currency, the
// sliding scale (floor + note), length, how it is held (one to one / group /
// not live), where (online / in person / both), sessions, places, picture,
// who can see it. Saved through the site's own saveContentAction.
// ============================================================================

export type ServiceKindProps = {
  /** The org whose services these are; any other "Making as" is refused. */
  orgId: string;
  orgName: string;
  initialServices: ServiceSummary[];
  initial: ServiceDraft | null;
  actions: {
    list(): Promise<ServiceSummary[]>;
    load(id: string): Promise<ServiceDraft | null>;
    save(draft: ServiceDraft, status: "draft" | "published"): Promise<{ ok: true; id: string; path: string | null } | { ok: false; error: string }>;
  };
  uploadEndpoint: string;
  libraryEndpoint: string;
  /** After a save; `published` is true when it went live (the popup closes on that). */
  onSaved?: (r: { id: string; path: string | null; published: boolean }) => void;
};

export function serviceExtension(props: ServiceKindProps): StudioExtension {
  return { id: "service", label: "Services", listLabel: "Services", render: () => <ServiceKind {...props} /> };
}

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="studio-field">
      <span>{label}</span>
      {children}
      {hint ? <small className="studio-hint">{hint}</small> : null}
    </label>
  );
}

function ServiceKind({ orgId, orgName, initialServices, initial, actions, uploadEndpoint, libraryEndpoint, onSaved }: ServiceKindProps) {
  const frame = useStudioFrame();
  const [services, setServices] = React.useState(initialServices);
  const [draft, setDraft] = React.useState<ServiceDraft>(initial ?? blankService());
  const [dirty, setDirty] = React.useState(false);
  const [busy, setBusy] = React.useState<null | "draft" | "published">(null);
  const [note, setNote] = React.useState<string | null>(null);
  // RichTextEditor reads its value once; a new key gives a loaded service a fresh editor.
  const [editorKey, setEditorKey] = React.useState(0);

  const edit = (patch: Partial<ServiceDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
    setNote(null);
  };

  const startNew = React.useCallback(() => {
    setDraft(blankService());
    setDirty(false);
    setNote(null);
    setEditorKey((k) => k + 1);
  }, []);
  useNewRequest(startNew);

  async function open(id: string) {
    if (dirty && !window.confirm("Leave this service without saving?")) return;
    const loaded = await actions.load(id);
    if (!loaded) return frame.setError("That service could not be opened.");
    frame.setError(null);
    setDraft(loaded);
    setDirty(false);
    setNote(null);
    setEditorKey((k) => k + 1);
  }

  async function save(status: "draft" | "published") {
    if (orgId !== frame.orgId) return frame.setError(`Services belong to ${orgName}: choose it under “Making as”.`);
    setBusy(status);
    frame.setError(null);
    const res = await actions.save(draft, status);
    setBusy(null);
    if (res.ok === false) return frame.setError(res.error);
    setDraft((d) => ({ ...d, id: res.id, status }));
    setDirty(false);
    setNote(status === "published" ? "Published" : "Draft saved");
    setServices(await actions.list());
    onSaved?.({ id: res.id, path: res.path, published: status === "published" });
  }

  const wrongOrg = frame.orgId !== orgId;
  const live = draft.status === "published";

  const drawer = (
    <>
      <div className="studio-panel__h">
        <span>Services</span>
        <button type="button" className="studio-btn" onClick={startNew}>
          New
        </button>
      </div>
      {services.length === 0 ? (
        <p className="studio-hint">No services yet. A reading or a counselling session starts here.</p>
      ) : (
        <div className="studio-list">
          {services.map((s) => (
            <button key={s.id} type="button" className={`sp-row ${draft.id === s.id ? "is-current" : ""}`} onClick={() => open(s.id)}>
              {s.coverImageUrl ? <img src={s.coverImageUrl} alt="" /> : <span className="sp-row__noimg" aria-hidden>◇</span>}
              <span className="sp-row__text">
                <span className="sp-row__title">{s.title || "Untitled service"}</span>
                <span className="sp-row__meta">
                  {s.status === "published" ? "Published" : "Draft"} · {fmt(s.updatedAt)}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  );

  const main = wrongOrg ? (
    <div className="he-sk-main">
      <p className="studio-hint">Services belong to {orgName}. Choose it under “Making as” to make or change one.</p>
    </div>
  ) : (
    <div className="he-sk-main">
      <input
        className="he-sk-title"
        value={draft.title}
        placeholder="The service’s name (“A typing reading”)"
        onChange={(e) => edit({ title: e.target.value })}
        aria-label="Title"
      />
      <input
        className="he-sk-sub"
        value={draft.subtitle}
        placeholder="A line under the name (optional)"
        onChange={(e) => edit({ subtitle: e.target.value })}
        aria-label="Subtitle"
      />
      <Field label="Summary" hint="One or two sentences for the card on /readings. Left blank, the start of the description is used.">
        <textarea className="studio-field__text" rows={2} maxLength={280} value={draft.summary} onChange={(e) => edit({ summary: e.target.value })} />
      </Field>
      <div className="he-sk-body">
        <span className="he-sk-label">Description</span>
        <RichTextEditor key={editorKey} value={draft.body} onChange={(html: string) => edit({ body: html })} toolbar="full" />
      </div>
    </div>
  );

  const settings = wrongOrg ? null : (
    <>
      <div className="studio-panel__h">
        <span>Price</span>
      </div>
      <div className="he-sk-row">
        <Field label="Price">
          <input className="studio-field__text" type="number" min="0" step="0.01" inputMode="decimal" value={draft.price} onChange={(e) => edit({ price: e.target.value })} />
        </Field>
        <Field label="Currency">
          <select value={draft.currency} onChange={(e) => edit({ currency: e.target.value })}>
            {["CAD", "USD", "EUR", "GBP"].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <label className="studio-check studio-check--row">
        <input type="checkbox" checked={draft.slidingScale} onChange={(e) => edit({ slidingScale: e.target.checked })} />
        <span>Sliding scale</span>
      </label>
      {draft.slidingScale ? (
        <>
          <Field label="Lowest price" hint="Below the price above. People choose what they pay between the two.">
            <input className="studio-field__text" type="number" min="0" step="0.01" inputMode="decimal" value={draft.priceSlidingMin} onChange={(e) => edit({ priceSlidingMin: e.target.value })} />
          </Field>
          <Field label="A note on the scale (optional)">
            <textarea className="studio-field__text" rows={2} maxLength={300} value={draft.slidingScaleNote} onChange={(e) => edit({ slidingScaleNote: e.target.value })} />
          </Field>
        </>
      ) : null}

      <div className="studio-panel__h">
        <span>The session</span>
      </div>
      <Field label="Kind">
        <select value={draft.bookingType} onChange={(e) => edit({ bookingType: e.target.value as ServiceDraft["bookingType"] })}>
          <option value="one_on_one">One to one</option>
          <option value="group">Group</option>
          <option value="async">Not live (written or recorded)</option>
        </select>
      </Field>
      <div className="he-sk-row">
        <Field label="Length (minutes)">
          <input className="studio-field__text" type="number" min="15" step="15" value={draft.durationMinutes} onChange={(e) => edit({ durationMinutes: e.target.value })} />
        </Field>
        <Field label="Sessions">
          <input className="studio-field__text" type="number" min="1" step="1" placeholder="1" value={draft.sessionCount} onChange={(e) => edit({ sessionCount: e.target.value })} />
        </Field>
      </div>
      <Field label="Where">
        <select value={draft.format} onChange={(e) => edit({ format: e.target.value as ServiceDraft["format"] })}>
          <option value="online">Online</option>
          <option value="in_person">In person</option>
          <option value="hybrid">Either</option>
        </select>
      </Field>
      {draft.format !== "online" ? (
        <Field label="Place">
          <input className="studio-field__text" value={draft.location} onChange={(e) => edit({ location: e.target.value })} />
        </Field>
      ) : null}
      <Field label="Booking">
        <select value={draft.registrationStatus} onChange={(e) => edit({ registrationStatus: e.target.value as ServiceDraft["registrationStatus"] })}>
          <option value="open">Open</option>
          <option value="waitlist">Waiting list</option>
          <option value="full">Full</option>
          <option value="closed">Closed</option>
        </select>
      </Field>

      <div className="studio-panel__h">
        <span>Picture</span>
      </div>
      <MediaPicker
        value={draft.coverImageUrl || undefined}
        onChange={(url?: string | null) => edit({ coverImageUrl: url ?? "" })}
        uploadEndpoint={uploadEndpoint}
        libraryEndpoint={libraryEndpoint}
        label="Picture"
        hint="On the card and at the top of the service’s page."
      />

      <div className="studio-panel__h">
        <span>Who sees it</span>
      </div>
      <Field label="Visible to">
        <select value={draft.visibility} onChange={(e) => edit({ visibility: e.target.value as ServiceDraft["visibility"] })}>
          <option value="PUBLIC">Everyone</option>
          <option value="ORGANIZATION">Members only</option>
        </select>
      </Field>
      {draft.id && draft.slug ? (
        <p className="studio-hint">
          Its page: <a href={`/services/${draft.slug}`} target="_blank" rel="noreferrer">/services/{draft.slug}</a>
        </p>
      ) : null}
    </>
  );

  return (
    <>
      <StudioTopStatus>
        {busy ? "Saving…" : note ?? (dirty ? "Unsaved" : draft.id ? (live ? "Published" : "Draft") : "New service")}
      </StudioTopStatus>
      {!wrongOrg ? (
        <StudioTopActions>
          <button type="button" className="studio-btn" disabled={Boolean(busy)} onClick={() => save("draft")}>
            {live ? "Move to draft" : "Save draft"}
          </button>
          <button type="button" className="studio-btn studio-btn--primary" disabled={Boolean(busy)} onClick={() => save("published")}>
            {live ? "Update" : "Publish"}
          </button>
        </StudioTopActions>
      ) : null}
      <StudioColumns drawer={drawer} main={main} settings={settings} />
    </>
  );
}
