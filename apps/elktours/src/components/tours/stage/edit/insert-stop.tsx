"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { fromPlace, num, type StopDraft } from "@/components/manage/tour-builder/draft";
import { getPlaceSheet, listPlaceSheet, nearbyPlaceSheet, type NearbyPlace } from "@/lib/office-actions";
import { AddPlaceBody, useAddPlace } from "@/components/office/add-place-popup";
import { Layer } from "./layer";
import { useStageEdit, type StageEditApi } from "./stage-edit-store";

type PlaceRow = Awaited<ReturnType<typeof listPlaceSheet>>[number];

function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Add the place as a stop at position `at` (0-based index in the whole list) and save. */
async function insertAt(api: StageEditApi, at: number, placeId: string) {
  const sheet = await getPlaceSheet(placeId).catch(() => null);
  if (!sheet) {
    toast.error("That place could not be opened.");
    return false;
  }
  const stop: StopDraft = fromPlace(sheet.place);
  const stops = [...api.stops.slice(0, at), stop, ...api.stops.slice(at)];
  return api.commit({ stops });
}

/** "Insert a stop between N and N+1": our places, places near the route, or a new place on the map. */
export function InsertStop({ at, onClose }: { at: number; onClose: () => void }) {
  const edit = useStageEdit();
  const api = edit?.api ?? null;
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<PlaceRow[] | null>(null);
  const [near, setNear] = useState<NearbyPlace[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [fresh, setFresh] = useState(false);

  const before = api && at > 0 ? api.stops[at - 1] : undefined;
  const after = api ? api.stops[at] : undefined;
  const refs = useMemo(
    () =>
      [before, after]
        .map((s) => (s && num(s.lat) != null && num(s.lng) != null ? { lat: num(s.lat)!, lng: num(s.lng)! } : null))
        .filter((p): p is { lat: number; lng: number } => !!p),
    [before, after]
  );
  const refKey = JSON.stringify(refs);

  useEffect(() => {
    listPlaceSheet().then(setRows).catch(() => setRows([]));
  }, []);
  useEffect(() => {
    const r = refs[0];
    if (!r) return void setNear([]);
    nearbyPlaceSheet(r.lat, r.lng, 600).then(setNear).catch(() => setNear([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refKey]);

  if (!api) return null;
  const onRoute = new Set(api.stops.map((s) => s.placeId).filter(Boolean) as string[]);
  const title = at === 0 ? "Add a stop first" : at >= api.stops.length ? `Add a stop after ${api.stops.length}` : `Insert a stop between ${at} and ${at + 1}`;

  async function pick(id: string) {
    setBusy(id);
    const ok = await insertAt(api!, at, id);
    setBusy(null);
    if (ok) onClose();
  }

  const needle = q.trim().toLowerCase();
  const found = (rows ?? []).filter((r) => !needle || r.title.toLowerCase().includes(needle) || (r.address ?? "").toLowerCase().includes(needle) || r.tags.some((t) => t.includes(needle))).slice(0, 12);
  const nearby = (near ?? [])
    .filter((p) => !onRoute.has(p.id))
    .map((p) => ({ p, d: Math.min(...refs.map((r) => metres(r, p))) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 6);

  return (
    <Layer title={title} onClose={onClose} wide>
      {fresh ? (
        <NewPlace at={at} api={api} centre={refs[0] ?? null} onBack={() => setFresh(false)} onAdded={onClose} />
      ) : (
        <div className="tse-form">
          <label className="tse-field">
            <span>Search our places</span>
            <input type="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="A name or an address" />
          </label>
          <ul className="tse-list">
            {rows === null && <li className="tse-note">Loading…</li>}
            {rows && found.length === 0 && <li className="tse-note">No place matches.</li>}
            {found.map((r) => (
              <li key={r.id}>
                <button type="button" disabled={busy !== null || onRoute.has(r.id)} onClick={() => void pick(r.id)}>
                  <span>
                    <strong>{r.title}</strong>
                    {r.address && <small>{r.address}</small>}
                  </span>
                  <span className="tse-list__act">{busy === r.id ? "Adding…" : onRoute.has(r.id) ? "Already a stop" : "Add here"}</span>
                </button>
              </li>
            ))}
          </ul>
          {nearby.length > 0 && (
            <>
              <h3 className="tse-h">Near the route</h3>
              <ul className="tse-list">
                {nearby.map(({ p, d }) => (
                  <li key={p.id}>
                    <button type="button" disabled={busy !== null} onClick={() => void pick(p.id)}>
                      <span>
                        <strong>{p.title}</strong>
                        {/* Distance to the nearest of the two neighbouring stops, not to the walked line. */}
                        <small>our place · {Math.round(d / 10) * 10} m off the route</small>
                      </span>
                      <span className="tse-list__act">{busy === p.id ? "Adding…" : "Add here"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="tse-row">
            <button type="button" className="tse-btn" onClick={() => setFresh(true)}>
              + A new place on the map
            </button>
          </div>
        </div>
      )}
    </Layer>
  );
}

/** The shared Add a place sheet; the place it lands on is inserted at `at` and the sheet stays open for its details. */
function NewPlace({ at, api, centre, onBack, onAdded }: { at: number; api: StageEditApi; centre: { lat: number; lng: number } | null; onBack: () => void; onAdded: () => void }) {
  const m = useAddPlace({
    centre,
    asStop: {
      next: at + 1,
      onRoute: new Map(api.stops.map((s, i) => [s.placeId ?? "", i + 1] as const).filter(([k]) => k)),
      add: async (placeId) => {
        await insertAt(api, at, placeId);
      },
    },
  });
  void onAdded;
  return (
    <AddPlaceBody
      m={m}
      mapClass="h-64 w-full"
      head={
        <button type="button" className="rounded-md border border-border px-3 py-1.5 hover:bg-accent" onClick={onBack}>
          Back
        </button>
      }
    />
  );
}
