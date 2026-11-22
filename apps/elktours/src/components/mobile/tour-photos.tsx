"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CoverFramer, MediaPicker, type CoverFrame } from "@elkdonis/cms-ui/files";
import { failToast } from "./fail-toast";
import { Sheet } from "./sheet";
import { addTourPhotoAction, archiveAssetAction, setAssetVisibleAction } from "@/lib/asset-actions";
import { setTourCoverAction } from "@/lib/hero-actions";

// The tour's photos on the phone media screen (2026-11-17, developer: "upload photos, assign from my folder or the
// org's, choose which is the cover and frame it like Para Theater's cover"). A photo comes from an upload, this site's
// library or the person's own files (MediaPicker, as on sunjay's banner editor), and is switched on at once. One of
// them is the cover (threads.metadata.coverImageUrl), framed with cms-ui's CoverFramer (metadata.coverFrame) for the
// three boxes it is shown in. With no cover the tour page and the Discover card play the 3D route.

export interface TourPhoto { id: string; url: string; visible: boolean }

// The boxes the cover is drawn in on the phone (sizes from the blocks): tour page arch, Discover card, Tours list card.
const SHAPES = {
  main: { label: "Tour page", aspect: 358 / 330 },
  also: [
    { label: "Discover card", aspect: 338 / 250 },
    { label: "Tours list", aspect: 112 / 144 },
  ],
};

export function TourPhotos({ tourId, photos, cover, coverFrame }: { tourId: string; photos: TourPhoto[]; cover: string | null; coverFrame: CoverFrame | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [frame, setFrame] = useState<CoverFrame | null>(coverFrame);
  const [framed, setFramed] = useState(false);

  const run = (key: string, job: () => Promise<{ ok: boolean; error?: string }>, done: string) => {
    setBusy(key);
    start(async () => {
      const r = await job().catch((e: unknown) => ({ ok: false, error: e instanceof Error ? e.message : "Failed" }));
      setBusy(null);
      if (!r.ok) return void failToast(r.error ?? "Failed");
      toast.success(done);
      router.refresh();
    });
  };

  const add = (url: string) => {
    if (!url) return;
    setAdding(false);
    run("add", () => addTourPhotoAction(tourId, url), "Photo added and shown on the tour page.");
  };
  const makeCover = (p: TourPhoto) => {
    setFrame(null);
    setFramed(false);
    run(`cover-${p.id}`, () => setTourCoverAction(tourId, p.url, null), "This photo is the cover now. Frame it below.");
  };
  const saveFrame = () => {
    if (!cover) return;
    run("frame", () => setTourCoverAction(tourId, cover, frame), "Framing saved.");
    setFramed(false);
  };
  const clearCover = () => run("clear", () => setTourCoverAction(tourId, null), "No cover photo: the tour page and the Discover card play the 3D route.");
  const remove = (p: TourPhoto) =>
    run(`rm-${p.id}`, async () => {
      if (p.url === cover) {
        const c = await setTourCoverAction(tourId, null);
        if (!c.ok) return c;
      }
      return archiveAssetAction(p.id);
    }, "Photo removed.");
  const toggle = (p: TourPhoto) => run(`vis-${p.id}`, () => setAssetVisibleAction(p.id, !p.visible), p.visible ? "Hidden from the tour page." : "Shown on the tour page.");

  return (
    <div className="bf-field">
      <span className="bf-label">Photos</span>
      {photos.length ? (
        <ul className="mtp-grid">
          {photos.map((p) => {
            const isCover = p.url === cover;
            return (
              <li key={p.id} className={`mtp-tile${isCover ? " is-cover" : ""}${p.visible ? "" : " is-off"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${p.url}${p.url.includes("?") ? "&" : "?"}w=320`} alt="" loading="lazy" />
                {isCover ? <span className="mtp-badge">Cover</span> : null}
                <span className="mtp-actions">
                  {!isCover && (
                    <button type="button" className="mtp-btn" disabled={pending} onClick={() => makeCover(p)}>
                      {busy === `cover-${p.id}` ? "…" : "Make cover"}
                    </button>
                  )}
                  <button type="button" className="mtp-btn" disabled={pending} onClick={() => toggle(p)}>
                    {p.visible ? "Hide" : "Show"}
                  </button>
                  <button type="button" className="mtp-btn" disabled={pending} aria-label="Remove this photo" onClick={() => remove(p)}>
                    Remove
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="bf-note">No photos yet. Without a cover photo the tour page and the Discover card play the 3D route.</p>
      )}
      <button type="button" className="bf-dashed" disabled={pending} onClick={() => setAdding(true)}>
        {busy === "add" ? "Adding the photo…" : "Add a photo"}
      </button>

      {cover ? (
        <div className="mtp-cover">
          <span className="bf-label">Frame the cover</span>
          <p className="bf-note">Drag the picture to choose what stays in view; zoom with the slider. The small boxes show it on the Discover card and in the Tours list.</p>
          <CoverFramer
            src={cover}
            frame={frame}
            onChange={(f) => {
              setFrame(f);
              setFramed(true);
            }}
            shape={SHAPES.main}
            alsoShapes={SHAPES.also}
          />
          <div className="mtp-cover-actions">
            <button type="button" className="mtp-btn is-primary" disabled={pending || !framed} onClick={saveFrame}>
              {busy === "frame" ? "Saving…" : "Save framing"}
            </button>
            <button type="button" className="mtp-btn" disabled={pending} onClick={clearCover}>
              No cover (play the 3D route)
            </button>
          </div>
        </div>
      ) : null}

      <Sheet open={adding} onOpenChange={setAdding} title="Add a photo" tall>
        <div className="mtp-sheet">
          <h2>Add a photo</h2>
          <MediaPicker
            onChange={add}
            uploadEndpoint="/api/upload"
            libraries={[
              { key: "org", label: "This site", endpoint: "/api/media/library" },
              { key: "mine", label: "My files", endpoint: "/api/media/library/mine" },
            ]}
            accept="image/*"
            preview="none"
            label="Photo"
          />
        </div>
      </Sheet>
    </div>
  );
}
