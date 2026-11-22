"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { failToast } from "./fail-toast";
import { Chip } from "@/components/mobile";
import { FormTop, Switch } from "./board-bits";
import { setAssetVisibleAction, upsertAssetAction } from "@/lib/asset-actions";
import { setHeroLeadAction } from "@/lib/hero-actions";
import { TourPhotos, type TourPhoto } from "./tour-photos";

// Screen 37, Tour page media (G7b): what guests see first. The switches are the existing per-asset visible switches
// (setAssetVisibleAction); the "Opens with" chips are setHeroLeadAction. The mobile form of components/manage/asset-panel.tsx.

type Lead = "film" | "map3d" | "photos";
export interface MediaItem { id: string; visible: boolean }
export interface MediaRows {
  film: { items: MediaItem[]; seconds: number | null };
  /** No row means the 3D map is on (default); the first switch-off creates the row. */
  map3d: { id: string | null; visible: boolean };
  cover: { items: MediaItem[] };
  gallery: { items: MediaItem[] };
  stills: { items: MediaItem[] };
  hasStops: boolean;
}

const LEAD_LABEL: Record<Lead, string> = { film: "Film", map3d: "3D route", photos: "Photos" };

export function TourMediaView({
  tours,
  tourId,
  title,
  slug,
  rows,
  lead,
  cover,
  coverFrame,
  photos,
}: {
  tours: Array<{ id: string; title: string }>;
  tourId: string;
  title: string;
  slug: string;
  rows: MediaRows;
  lead: Lead | null;
  /** The cover photo; null when there is none (a fly-over still does not count, lib/cover.ts). */
  cover: string | null;
  coverFrame: { fx: number; fy: number; zoom: number } | null;
  /** The tour's gallery photos (image assets), newest first. */
  photos: TourPhoto[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [leadNow, setLeadNow] = useState<Lead | null>(lead);
  const [busy, setBusy] = useState<string | null>(null);

  const available: Lead[] = [
    ...(rows.film.items.length ? (["film"] as Lead[]) : []),
    ...(rows.hasStops ? (["map3d"] as Lead[]) : []),
    ...(cover || rows.gallery.items.length ? (["photos"] as Lead[]) : []),
  ];

  const toggle = (key: string, ids: string[], visible: boolean) => {
    setBusy(key);
    start(async () => {
      for (const id of ids) {
        const r = await setAssetVisibleAction(id, visible).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Failed" }));
        if (!r.ok) {
          setBusy(null);
          return void failToast(r.error);
        }
      }
      setBusy(null);
      toast.success(visible ? "Shown on the tour page." : "Hidden from the tour page.");
      router.refresh();
    });
  };

  const toggleMap = (visible: boolean) => {
    if (rows.map3d.id) return toggle("map3d", [rows.map3d.id], visible);
    setBusy("map3d");
    start(async () => {
      const r = await upsertAssetAction({ threadId: tourId, kind: "map3d", visible }).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Failed" }));
      setBusy(null);
      if (!r.ok) return void failToast(r.error);
      toast.success(visible ? "Shown on the tour page." : "Hidden from the tour page.");
      router.refresh();
    });
  };

  const chooseLead = (l: Lead) => {
    const next = leadNow === l ? null : l;
    setLeadNow(next);
    start(async () => {
      const r = await setHeroLeadAction(tourId, next);
      if (!r.ok) {
        setLeadNow(leadNow);
        return void failToast(r.error);
      }
      toast.success(next ? `The page opens on ${LEAD_LABEL[next].toLowerCase()}.` : "The page picks what to open on.");
    });
  };

  const groupRow = (key: string, label: string, note: string, items: MediaItem[]) => {
    const on = items.some((i) => i.visible);
    return (
      <div key={key} className={`bf-row${on ? "" : " is-off"}`}>
        <span className="bf-row-text">{label}<small>{items.length ? note : "None yet"}</small></span>
        <Switch on={on} disabled={!items.length || busy === key || pending} label={`Show ${label}`} onChange={(v) => toggle(key, items.map((i) => i.id), v)} />
      </div>
    );
  };

  return (
    <div className="bf">
      <FormTop href={`/manage/tours/${tourId}`} kicker="Tour page" title={title} />
      {tours.length > 1 && (
        <div className="m-chip-row" style={{ marginTop: 16 }}>
          {tours.map((t) => (
            <Link key={t.id} href={`/manage/tours/${t.id}/assets`} className={`m-chip${t.id === tourId ? " is-selected" : ""}`} style={{ textDecoration: "none" }}>
              {t.title}
            </Link>
          ))}
        </div>
      )}
      <div className="bf-body">
        <h2 className="bf-h">What guests see first</h2>
        <p className="bf-sub">The page opens on one of these, in the arched window at the top. Guests can switch to anything else that is on.</p>

        <TourPhotos tourId={tourId} photos={photos} cover={cover} coverFrame={coverFrame} />

        <div className="bf-field">
          <span className="bf-label">Opens with</span>
          {available.length ? (
            <div className="bf-wrap">
              {available.map((l) => (
                <Chip key={l} selected={leadNow === l} onClick={() => chooseLead(l)}>{LEAD_LABEL[l]}</Chip>
              ))}
            </div>
          ) : (
            <p className="bf-note">Nothing to open on yet. Add a film, place the stops on the map, or switch on a picture.</p>
          )}
        </div>

        <div className="bf-field">
          <span className="bf-label">On the page</span>
          <div className="bf-media">
            {groupRow("film", "Fly-over film", rows.film.seconds ? `${Math.round(rows.film.seconds)} seconds` : "Film", rows.film.items.slice(0, 1))}
            {rows.film.items.length === 0 && (
              <Link href={`/manage/tours/${tourId}/flyover`} className="bf-dashed">Request a fly-over film</Link>
            )}
            <div className={`bf-row${rows.map3d.visible ? "" : " is-off"}`}>
              <span className="bf-row-text">3D route preview<small>{rows.hasStops ? "Needs the stops on the map" : "Add stops on the map first"}</small></span>
              <Switch on={rows.map3d.visible} disabled={!rows.hasStops || busy === "map3d" || pending} label="Show the 3D route preview" onChange={toggleMap} />
            </div>
            {groupRow("cover", "Fly-over poster", "A frame of the film", rows.cover.items)}
            {groupRow("gallery", "Gallery", `${rows.gallery.items.length} ${rows.gallery.items.length === 1 ? "picture" : "pictures"}`, rows.gallery.items)}
            {groupRow("stills", "Street View stills", "One at each stop", rows.stills.items)}
          </div>
        </div>

        <p className="bf-note">New pictures and films arrive switched off. Nothing reaches the page until it is on.</p>
        <Link href={`/tours/${slug}`} className="bf-dashed">Preview the guest page</Link>
      </div>
    </div>
  );
}
