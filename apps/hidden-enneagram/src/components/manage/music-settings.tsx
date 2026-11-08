"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Notice } from "@elkdonis/cms-ui/manage";
import { saveAudioConfigAction } from "@/lib/audio-config-actions";
import { normalisePath, type AudioConfig, type MusicTrack } from "@/lib/audio-config-schema";
import { TEMPERAMENTS, TUNINGS, type Temperament, type TuningKey } from "@/lib/sound/tuning";

const KEYS = ["", "C", "C#", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "Ab", "A", "Bb", "B"];
const TONICS = ["C3", "D3", "E3", "F3", "G3", "A3", "B3", "C4", "D4", "E4", "F4", "G4", "A4"];
const MAX_TRACKS = 50;

interface LibraryItem {
  id: string;
  url: string;
  filename: string;
}

const row: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" };
const field: React.CSSProperties = { display: "grid", gap: 4, fontSize: "0.85rem" };

export function MusicSettings({ initial, library }: { initial: AudioConfig; library: LibraryItem[] }) {
  const [state, setState] = useState<AudioConfig>(initial);
  const [saved, setSaved] = useState<string>(() => JSON.stringify(initial));
  const [pathsText, setPathsText] = useState(initial.music.paths.join("\n"));
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pick, setPick] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty = JSON.stringify(state) !== saved;
  const music = state.music;
  const figure = state.figure;

  const setMusic = (patch: Partial<AudioConfig["music"]>) => setState((s) => ({ ...s, music: { ...s.music, ...patch } }));
  const setFigure = (patch: Partial<AudioConfig["figure"]>) => setState((s) => ({ ...s, figure: { ...s.figure, ...patch } }));
  const setTracks = (tracks: MusicTrack[]) => setMusic({ tracks });
  const patchTrack = (id: string, patch: Partial<MusicTrack>) =>
    setTracks(music.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= music.tracks.length) return;
    const next = [...music.tracks];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setTracks(next);
  };
  const addTrack = (url: string, title: string) => {
    if (music.tracks.length >= MAX_TRACKS) {
      toast.error(`A list holds at most ${MAX_TRACKS} tracks.`);
      return;
    }
    const track: MusicTrack = { id: crypto.randomUUID().slice(0, 8), url, title, artist: "Ario", key: "" };
    setState((s) => ({ ...s, music: { ...s.music, tracks: [...s.music.tracks, track] } }));
  };

  async function upload(file: File) {
    setUploading(true);
    setUploadError(null);
    const name = file.name.replace(/\.[^./\\]+$/, "");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "audio");
      fd.append("title", name);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? `Upload failed (${res.status}).`);
      addTrack(data.url, name);
      toast.success("Uploaded. Press Save to keep it in the list.");
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function onPaths(text: string) {
    setPathsText(text);
    const paths = text
      .split("\n")
      .map((l) => normalisePath(l))
      .filter((p): p is string => Boolean(p));
    setMusic({ paths: [...new Set(paths)] });
  }

  function save() {
    startTransition(async () => {
      const res = await saveAudioConfigAction(state);
      if (res.ok && res.config) {
        setState(res.config);
        setSaved(JSON.stringify(res.config));
        setPathsText(res.config.music.paths.join("\n"));
        toast.success("Music settings saved.");
      } else {
        toast.error(res.error ?? "Could not save.");
      }
    });
  }

  const unusedLibrary = library.filter((l) => !music.tracks.some((t) => t.url === l.url));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (dirty && !pending) save();
      }}
    >
      <div className="he-m-cols">
        <section className="he-m-card" aria-labelledby="he-music-h">
          <h2 id="he-music-h">Background music</h2>
          <p>
            <label style={row}>
              <input type="checkbox" checked={music.enabled} onChange={(e) => setMusic({ enabled: e.target.checked })} />
              <span>Offer background music on the site</span>
            </label>
          </p>
          {music.enabled && music.tracks.length === 0 ? (
            <p className="he-m-fine" role="status">
              Add at least one track: with none, the music stays off when saved.
            </p>
          ) : null}

          <h3 style={{ fontSize: "1rem", margin: "1em 0 0.5em" }}>Tracks</h3>
          {music.tracks.length === 0 ? <p className="he-m-fine">No tracks yet.</p> : null}
          <ol className="he-m-plain" style={{ gap: 16 }}>
            {music.tracks.map((t, i) => (
              <li key={t.id} style={{ display: "grid", gap: 8 }}>
                <div style={row}>
                  <label style={field}>
                    Title
                    <input type="text" value={t.title} maxLength={160} onChange={(e) => patchTrack(t.id, { title: e.target.value })} />
                  </label>
                  <label style={field}>
                    Artist
                    <input type="text" value={t.artist} maxLength={160} onChange={(e) => patchTrack(t.id, { artist: e.target.value })} />
                  </label>
                  <label style={field}>
                    Key
                    <select value={t.key} onChange={(e) => patchTrack(t.id, { key: e.target.value })}>
                      {KEYS.map((k) => (
                        <option key={k} value={k}>
                          {k === "" ? "Unknown" : k}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <audio controls preload="none" src={t.url} aria-label={`Preview: ${t.title}`} style={{ maxWidth: "100%" }} />
                <div style={row}>
                  <button type="button" className="he-btn" onClick={() => move(i, -1)} disabled={i === 0}>
                    Move up
                  </button>
                  <button type="button" className="he-btn" onClick={() => move(i, 1)} disabled={i === music.tracks.length - 1}>
                    Move down
                  </button>
                  <button type="button" className="he-btn" onClick={() => setTracks(music.tracks.filter((x) => x.id !== t.id))}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ol>

          <div style={{ display: "grid", gap: 6, marginTop: 16 }}>
            <label style={field}>
              Upload a track
              <input
                ref={fileRef}
                type="file"
                accept="audio/*"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f);
                }}
              />
            </label>
            {uploading ? (
              <p className="he-m-fine" role="status">
                Uploading, please wait&hellip;
              </p>
            ) : null}
            {uploadError ? (
              <p className="he-m-fine" role="alert">
                {uploadError}
              </p>
            ) : null}
            <p className="he-m-fine">Up to 60 MB per file.</p>
          </div>

          <div style={{ ...row, marginTop: 12, alignItems: "end" }}>
            <label style={field}>
              Add from uploaded
              <select value={pick} onChange={(e) => setPick(e.target.value)} disabled={unusedLibrary.length === 0}>
                <option value="">{unusedLibrary.length ? "Choose a file…" : "Nothing else uploaded"}</option>
                {unusedLibrary.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.filename}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="he-btn"
              disabled={!pick}
              onClick={() => {
                const item = unusedLibrary.find((l) => l.id === pick);
                if (!item) return;
                addTrack(item.url, item.filename.replace(/\.[^./\\]+$/, ""));
                setPick("");
              }}
            >
              Add
            </button>
          </div>

          <p style={{ marginTop: 20 }}>
            <label style={field}>
              <span>
                Start volume: <b>{Math.round(music.volume * 100)}%</b>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(music.volume * 100)}
                onChange={(e) => setMusic({ volume: Number(e.target.value) / 100 })}
              />
            </label>
          </p>

          <fieldset style={{ border: 0, padding: 0, margin: "12px 0" }}>
            <legend>Mode</legend>
            <label style={row}>
              <input type="radio" name="he-music-mode" checked={music.mode === "loop"} onChange={() => setMusic({ mode: "loop" })} />
              <span>Loop one track</span>
            </label>
            <label style={row}>
              <input type="radio" name="he-music-mode" checked={music.mode === "playlist"} onChange={() => setMusic({ mode: "playlist" })} />
              <span>Play the list, then start again</span>
            </label>
          </fieldset>

          <fieldset style={{ border: 0, padding: 0, margin: "12px 0" }}>
            <legend>Pages</legend>
            <label style={row}>
              <input type="radio" name="he-music-pages" checked={music.pages === "all"} onChange={() => setMusic({ pages: "all" })} />
              <span>Every page</span>
            </label>
            <label style={row}>
              <input type="radio" name="he-music-pages" checked={music.pages === "chosen"} onChange={() => setMusic({ pages: "chosen" })} />
              <span>Only these pages</span>
            </label>
            {music.pages === "chosen" ? (
              <label style={{ ...field, marginTop: 8 }}>
                Paths, one per line (for example /, /enneagram)
                <textarea rows={4} value={pathsText} onChange={(e) => onPaths(e.target.value)} spellCheck={false} />
              </label>
            ) : null}
          </fieldset>

          <Notice tone="warn">
            {"Upload only music you have the rights to: your own compositions and recordings, or tracks licensed for use on a website. Covers, samples and other people's recordings (including Gurdjieff / de Hartmann recordings) need a licence."}
          </Notice>
          <p className="he-m-fine">
            {"Visitors always start the music themselves: the site shows a 'Play Ario's music' invitation and never plays sound on its own. Aim for files mastered quietly (around -20 LUFS); MP3 or AAC (.m4a) play everywhere."}
          </p>
        </section>

        <section className="he-m-card" aria-labelledby="he-figure-h">
          <h2 id="he-figure-h">The figure&rsquo;s sound (site defaults)</h2>
          <div style={{ display: "grid", gap: 12 }}>
            <label style={field}>
              Tuning
              <select value={figure.tuning} onChange={(e) => setFigure({ tuning: e.target.value as TuningKey })}>
                {TUNINGS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={field}>
              Temperament
              <select value={figure.temperament} onChange={(e) => setFigure({ temperament: e.target.value as Temperament })}>
                {TEMPERAMENTS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={field}>
              &ldquo;do&rdquo; is
              <select value={figure.tonic} onChange={(e) => setFigure({ tonic: e.target.value })}>
                {TONICS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label style={row}>
              <input type="checkbox" checked={figure.follow} onChange={(e) => setFigure({ follow: e.target.checked })} />
              <span>Tune the figure to the key of the track that is playing</span>
            </label>
          </div>
          <p className="he-m-fine">
            Blocks can choose their own; these apply where a block says &lsquo;Site default&rsquo;. Non-Ouspensky tunings are labelled &lsquo;an
            interpretation&rsquo; on the page.
          </p>
        </section>
      </div>

      <p className="he-m-actions">
        <button type="submit" className="he-btn he-primary" disabled={!dirty || pending}>
          {pending ? "Saving…" : "Save"}
        </button>{" "}
        {dirty ? <span className="he-m-fine">Unsaved changes.</span> : null}
      </p>
    </form>
  );
}
