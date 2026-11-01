"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import type { AuctionSeries } from "@elkdonis/commerce/queries";
import type { WeekItemThread } from "@elkdonis/commerce/server";
import { Dialog, MediaDrop, RepostPicker } from "./manage/panels";
import { saveSeriesAction, addWeekItemAction, submitOwnPieceAction } from "./manage/actions";
import type { SeriesHero, SeriesTheme } from "./series-template";

// Editing on the series page (2026-10-28): editors change the cover and the
// text in place and add artwork or articles; contributors and the series'
// artists add their own published pieces for an editor to approve.

function WeekSelect({ weekCount, value, onChange, id }: { weekCount: number; value: number; onChange: (n: number) => void; id: string }) {
  return (
    <div className="sw-field">
      <label htmlFor={id} className="sw-label">Week</label>
      <select id={id} className="sw-select" value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {Array.from({ length: weekCount }, (_, i) => <option key={i + 1} value={i + 1}>Week {i + 1}</option>)}
      </select>
    </div>
  );
}

export function AddArticleButton({ series, role, defaultWeek, className = "srs-btn is-ghost is-small" }: {
  series: AuctionSeries;
  role: "editor" | "contributor";
  defaultWeek: number;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [week, setWeek] = React.useState(defaultWeek);
  const [busy, setBusy] = React.useState(false);
  async function add(t: WeekItemThread) {
    setBusy(true);
    const r = role === "editor"
      ? await addWeekItemAction(series.id, series.slug, { weekNo: week, kind: "article", threadId: t.id })
      : await submitOwnPieceAction(series.id, series.slug, t.id, week);
    setBusy(false);
    if (!r.ok) return toast.error(r.error ?? "Could not add it.");
    toast.success(role === "editor" ? "Added to the series." : "Sent to the series' editors for approval.");
    setOpen(false);
    router.refresh();
  }
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>+ Add article</button>
      <Dialog open={open} onClose={() => setOpen(false)} title={role === "editor" ? "Add an article to the series" : "Add one of your pieces"}>
        <WeekSelect id="aa-week" weekCount={series.weekCount} value={week} onChange={setWeek} />
        <RepostPicker series={series} mineOnly={role !== "editor"} onPick={(t) => !busy && add(t)} />
        <p className="sw-hint" style={{ margin: 0 }}>
          Not written yet? <a href={`${process.env.NEXT_PUBLIC_ARTS_COLLECTIVE_URL ?? ""}/studio?kind=writing`} target="_blank" rel="noopener">Write it in the Studio</a>, publish it, then add it here.
          {role === "editor" ? " Images, videos and announcements are added from Weeks & content in the workspace." : ""}
        </p>
      </Dialog>
    </>
  );
}

export function EditorBar({ series, role, defaultWeek }: { series: AuctionSeries; role: "editor" | "contributor"; defaultWeek: number }) {
  return (
    <div className="srs-editbar sw" style={{ minHeight: 0 }}>
      <div className="srs-editbar-inner srs-wrap">
        <span>
          <strong>{role === "editor" ? "You are editing this series" : "You are part of this series"}</strong>
          <span className="sw-muted"> · {series.status === "draft" ? "draft, visible only to the team" : series.status === "closed" ? "closed" : "published"}</span>
        </span>
        <span style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {role === "editor" && <Link href={`/series/${series.slug}/manage`} className="sw-btn is-quiet">Workspace</Link>}
          {role === "editor" && <Link href={`/series/${series.slug}/manage/lots/new`} className="sw-btn is-outline">+ Add artwork</Link>}
          <AddArticleButton series={series} role={role} defaultWeek={defaultWeek} className="sw-btn" />
        </span>
      </div>
    </div>
  );
}

function useSave(series: AuctionSeries) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const save = async (input: Parameters<typeof saveSeriesAction>[2], ok: string) => {
    setBusy(true);
    const r = await saveSeriesAction(series.id, series.slug, input);
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error ?? "Could not save.");
      return false;
    }
    toast.success(ok);
    router.refresh();
    return true;
  };
  return { busy, save };
}

export function HeroEditButtons({ series }: { series: AuctionSeries }) {
  const theme = (series.theme ?? {}) as SeriesTheme;
  const { busy, save } = useSave(series);
  const [cover, setCover] = React.useState(false);
  const [text, setText] = React.useState(false);
  const [hero, setHero] = React.useState<SeriesHero>(theme.hero ?? { kind: "image", url: "" });
  const [title, setTitle] = React.useState(series.title);
  const [eyebrow, setEyebrow] = React.useState(series.card.eyebrow ?? "");
  const [curatorName, setCuratorName] = React.useState(theme.curator?.name ?? "");
  const [curatorRole, setCuratorRole] = React.useState(theme.curator?.role ?? "");
  const [subtitle, setSubtitle] = React.useState(series.subtitle ?? "");

  return (
    <>
      <button type="button" className="srs-edit-chip" onClick={() => setCover(true)}>Change cover</button>
      <button type="button" className="srs-edit-chip" onClick={() => setText(true)}>Edit text</button>

      <Dialog open={cover} onClose={() => setCover(false)} title="Change the cover">
        <div className="sw-seg" role="group" aria-label="Cover type">
          {(["image", "video", "embed"] as const).map((k) => (
            <button key={k} type="button" aria-pressed={hero.kind === k} onClick={() => setHero({ kind: k, url: hero.kind === k ? hero.url : "" })}>
              {k === "image" ? "Image" : k === "video" ? "Uploaded video" : "YouTube / Vimeo"}
            </button>
          ))}
        </div>
        {hero.kind === "embed" ? (
          <div className="sw-field"><label htmlFor="hc-embed" className="sw-label">Video link</label><input id="hc-embed" className="sw-input" value={hero.url} onChange={(e) => setHero({ ...hero, url: e.target.value })} placeholder="https://www.youtube.com/watch?v=…" /></div>
        ) : (
          <>
            {hero.url && (hero.kind === "video"
              ? <video src={hero.url} muted controls style={{ width: "100%", borderRadius: 8 }} />
              // eslint-disable-next-line @next/next/no-img-element
              : <img src={hero.url} alt="" style={{ width: "100%", borderRadius: 8 }} />)}
            <MediaDrop seriesId={series.id} accept={hero.kind === "video" ? "video/mp4,video/webm" : "image/*"} label={hero.kind === "video" ? "choose a video" : "choose an image"} onUploaded={(url) => setHero({ ...hero, url })} />
            {hero.kind === "video" && (
              <div className="sw-field"><span className="sw-label">Poster image</span><MediaDrop seriesId={series.id} accept="image/*" label="choose an image" onUploaded={(url) => setHero({ ...hero, poster: url })} /></div>
            )}
          </>
        )}
        <div className="sw-dialog-foot">
          {theme.hero?.url && <button type="button" className="sw-btn is-danger" disabled={busy} onClick={async () => { if (await save({ theme: { ...series.theme, hero: null } }, "Cover removed.")) setCover(false); }}>Remove cover</button>}
          <button type="button" className="sw-btn" disabled={busy || !hero.url} onClick={async () => { if (await save({ theme: { ...series.theme, hero } }, "Cover saved.")) setCover(false); }}>Save cover</button>
        </div>
      </Dialog>

      <Dialog open={text} onClose={() => setText(false)} title="Edit the title">
        <div className="sw-field"><label htmlFor="ht-eye" className="sw-label">Line above the name</label><input id="ht-eye" className="sw-input" value={eyebrow} onChange={(e) => setEyebrow(e.target.value)} placeholder="Auction Series 1" /></div>
        <div className="sw-field"><label htmlFor="ht-title" className="sw-label">Series name</label><input id="ht-title" className="sw-input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="sw-grid cols-2">
          <div className="sw-field"><label htmlFor="ht-cn" className="sw-label">Curated by</label><input id="ht-cn" className="sw-input" value={curatorName} onChange={(e) => setCuratorName(e.target.value)} /></div>
          <div className="sw-field"><label htmlFor="ht-cr" className="sw-label">Curator&rsquo;s role</label><input id="ht-cr" className="sw-input" value={curatorRole} onChange={(e) => setCuratorRole(e.target.value)} /></div>
        </div>
        <div className="sw-field"><label htmlFor="ht-sub" className="sw-label">Subtitle (shown when there is no curator)</label><input id="ht-sub" className="sw-input" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} /></div>
        <div className="sw-dialog-foot">
          <button type="button" className="sw-btn" disabled={busy}
            onClick={async () => {
              const curator = curatorName ? { ...(theme.curator ?? {}), name: curatorName, role: curatorRole } : null;
              if (await save({ title, subtitle: subtitle || null, card: { ...series.card, eyebrow: eyebrow || undefined }, theme: { ...series.theme, curator } }, "Saved.")) setText(false);
            }}>
            Save
          </button>
        </div>
      </Dialog>
    </>
  );
}

export function EditWriteUpButton({ series }: { series: AuctionSeries }) {
  const { busy, save } = useSave(series);
  const [open, setOpen] = React.useState(false);
  const [html, setHtml] = React.useState(series.descriptionHtml ?? "");
  return (
    <>
      <button type="button" className="srs-btn is-ghost is-small srs-inline-edit" onClick={() => setOpen(true)}>Edit write-up</button>
      <Dialog open={open} onClose={() => setOpen(false)} title="The curator's write-up">
        <RichTextEditor value={html} onChange={setHtml} minHeight={260} ariaLabel="Write-up" placeholder="What the series brings together, how the works were chosen, what to look for…" />
        <div className="sw-dialog-foot">
          <button type="button" className="sw-btn" disabled={busy} onClick={async () => { if (await save({ descriptionHtml: html || null }, "Write-up saved.")) setOpen(false); }}>Save</button>
        </div>
      </Dialog>
    </>
  );
}
