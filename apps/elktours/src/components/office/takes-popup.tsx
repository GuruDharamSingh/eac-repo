"use client";

import * as React from "react";
import { toast } from "sonner";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import { SurfaceFrame, SurfaceSkeleton, type SurfaceDescriptor } from "@elkdonis/cms-ui/surface";
import { MediaField } from "@/components/manage/media-field";
import { getTakesSheetAction, saveTakeAction, type TakesSheet } from "@/lib/guide-take-actions";

/** The hub card's descriptor (registered as `office-takes` in HubSurfaces). */
export const takesDescriptor: SurfaceDescriptor = {
  type: "custom",
  key: "office-takes",
  title: "Personal takes on a tour",
  kind: "event",
  size: "wide",
};

const label = "text-xs font-medium uppercase tracking-wider text-muted-foreground";
const plain = (html: string | null) => (html ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

function TakeEditor({
  tourId,
  stopId,
  title,
  siteText,
  initialBody,
  initialMedia,
}: {
  tourId: string;
  stopId: string | null;
  title: string;
  siteText: string | null;
  initialBody: string;
  initialMedia: string;
}) {
  const [body, setBody] = React.useState(initialBody);
  const [media, setMedia] = React.useState(initialMedia);
  const [saved, setSaved] = React.useState({ body: initialBody, media: initialMedia });
  const [busy, setBusy] = React.useState(false);
  const dirty = body !== saved.body || media !== saved.media;

  async function save() {
    setBusy(true);
    const r = await saveTakeAction({ tourId, stopId, body, mediaUrl: media || null }).catch(() => ({ ok: false as const, error: "Could not save your take." }));
    setBusy(false);
    if (r.ok === false) return void toast.error(r.error);
    setSaved({ body, media });
    toast.success(r.take ? "Your take is saved" : "Your take is removed");
  }

  return (
    <section className="rounded-md border border-border">
      <h4 className="border-b border-border px-3 py-2 font-medium">{title}</h4>
      <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div>
          <span className={label}>The site's text</span>
          <p className="mt-1 line-clamp-6 text-muted-foreground">{plain(siteText) || "No text on this stop yet."}</p>
        </div>
        <div className="space-y-2">
          <span className={label}>Your take</span>
          <RichTextEditor value={body} onChange={setBody} toolbar="compact" />
          <MediaField value={media} onChange={setMedia} label="Your picture (optional)" />
          <button type="button" disabled={busy || !dirty} onClick={save} className="rounded-md border border-border px-3 py-1.5 hover:bg-accent disabled:opacity-50">
            {busy ? "Saving…" : dirty ? "Save my take" : "Saved"}
          </button>
        </div>
      </div>
    </section>
  );
}

/**
 * Personal takes (hub, 2026-11-19): pick a tour; beside the site's own text for the tour and each stop, write your
 * take and add a picture. Your takes appear on the tour page, signed with your name, while you lead an upcoming run
 * of the tour (developer's choice, 2026-11-19).
 */
export function TakesPopup(_props: { descriptor: Extract<SurfaceDescriptor, { type: "custom" }> }) {
  const [sheet, setSheet] = React.useState<TakesSheet | null>(null);

  const load = React.useCallback(async (id?: string) => {
    setSheet(null);
    const s = await getTakesSheetAction(id ?? null).catch(() => null);
    if (!s) return void toast.error("Could not load the tour.");
    setSheet(s);
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);

  if (!sheet) {
    return (
      <SurfaceFrame kind="event" kicker="Office" title="Personal takes">
        <SurfaceSkeleton block />
      </SurfaceFrame>
    );
  }
  if (!sheet.tour) {
    return (
      <SurfaceFrame kind="event" kicker="Office" title="Personal takes">
        <p className="text-sm text-muted-foreground">There are no tours yet.</p>
      </SurfaceFrame>
    );
  }
  const tour = sheet.tour;

  return (
    <SurfaceFrame
      kind="event"
      kicker="Office"
      title={`Your takes: ${tour.title}`}
      actions={[{ label: "Open the tour page", href: `/tours/${tour.slug}`, external: true, quiet: true }]}
      status={sheet.leadsARun ? "Shown on the tour page: you lead an upcoming run" : "Saved but not shown yet: you have no upcoming run of this tour"}
    >
      <div className="space-y-4 text-sm">
        <label className="block max-w-md">
          <span className={label}>Tour</span>
          <select value={tour.id} onChange={(e) => void load(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2">
            {sheet.tours.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
                {t.status === "published" ? "" : ` (${t.status})`}
              </option>
            ))}
          </select>
        </label>
        <TakeEditor
          key={`${tour.id}:tour`}
          tourId={tour.id}
          stopId={null}
          title="The tour as a whole"
          siteText={null}
          initialBody={sheet.mine[""]?.body ?? ""}
          initialMedia={sheet.mine[""]?.mediaUrl ?? ""}
        />
        {sheet.stops.map((s, i) => (
          <TakeEditor
            key={`${tour.id}:${s.id}`}
            tourId={tour.id}
            stopId={s.id}
            title={`${i + 1}. ${s.title}`}
            siteText={s.body}
            initialBody={sheet.mine[s.id]?.body ?? ""}
            initialMedia={sheet.mine[s.id]?.mediaUrl ?? ""}
          />
        ))}
        {sheet.stops.length === 0 && <p className="text-muted-foreground">This tour has no stops yet.</p>}
      </div>
    </SurfaceFrame>
  );
}
