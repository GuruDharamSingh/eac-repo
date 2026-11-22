"use client";

import * as React from "react";
import { startChunkedUpload } from "../capture/upload";
import type { TakeResult } from "./capture";
import { download } from "./render2d";
import { canMakeMp4, toMp4 } from "./mp4";

// ============================================================================
// After a take (record mode, 2026-11-18): the clip plays back, with Download,
// Send to video editor (Private/Video/Recordings, then a link that opens it as
// a new clip reel), Record again and Discard. It closes only through its
// buttons, so a take is never lost to a stray key.
// ============================================================================

export interface ReviewProps {
  result: TakeResult;
  name: string;
  W: number;
  H: number;
  /** Whether settings were dragged during the take (they were for that take only). */
  overrides: boolean;
  recording?: { uploadEndpoint: string; reelHref: string };
  onRecordAgain(): void;
  onDiscard(): void;
  /** The clip has left the browser (sent) or the person kept it (downloaded): leaving the page is fine. */
  onSafe(): void;
}

export function Review({ result, name: takeName, W, H, overrides, recording, onRecordAgain, onDiscard, onSafe }: ReviewProps) {
  // the clip on offer: a WebM take is swapped for its MP4 once converted (WhatsApp and Instagram need MP4)
  const [clip, setClip] = React.useState({ blob: result.blob, mime: result.mime, name: takeName });
  const [conv, setConv] = React.useState<null | number | "failed" | "unavailable">(null);
  React.useEffect(() => {
    setClip({ blob: result.blob, mime: result.mime, name: takeName });
    if (!result.mime.includes("webm")) return setConv(null);
    let live = true;
    void (async () => {
      if (!(await canMakeMp4(W, H))) { if (live) setConv("unavailable"); return; }
      if (live) setConv(0);
      try {
        let last = -1;
        const mp4 = await toMp4(result.blob, { onProgress: (p) => { const pct = Math.floor(p * 100); if (live && pct !== last) { last = pct; setConv(pct); } } });
        if (live) { setClip({ blob: mp4, mime: "video/mp4", name: takeName.replace(/\.webm$/i, ".mp4") }); setConv(null); }
      } catch {
        if (live) setConv("failed");
      }
    })();
    return () => { live = false; };
  }, [result, takeName, W, H]);
  const name = clip.name;
  const url = React.useMemo(() => URL.createObjectURL(clip.blob), [clip.blob]);
  React.useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const converting = typeof conv === "number";
  const [send, setSend] = React.useState<{ state: "idle" | "sending" | "sent" | "failed"; pct: number; path?: string; error?: string }>({ state: "idle", pct: 0 });
  const fixed = React.useRef(false);
  const ext = clip.mime.includes("mp4") ? "MP4" : "WebM";

  async function sendToEditor() {
    if (!recording) return;
    setSend({ state: "sending", pct: 0 });
    try {
      const up = await startChunkedUpload(recording.uploadEndpoint, { body: { name } }, (sent) => setSend((s) => ({ ...s, pct: Math.min(99, Math.round((sent / clip.blob.size) * 100)) })));
      up.push(clip.blob);
      const { path } = await up.finish();
      setSend({ state: "sent", pct: 100, path });
      onSafe();
    } catch (e) {
      setSend({ state: "failed", pct: 0, error: e instanceof Error ? e.message : "The upload failed." });
    }
  }

  const sending = send.state === "sending";
  const reelLink = send.path && recording
    ? `${recording.reelHref}${recording.reelHref.includes("?") ? "&" : "?"}new=clip&clip=${encodeURIComponent(send.path)}`
    : null;

  return (
    <div className="wa-review" role="dialog" aria-label="Recording review" data-name={name}>
      <video
        className="wa-review__video"
        src={url}
        loop
        autoPlay
        muted
        playsInline
        controls
        style={{ aspectRatio: `${W} / ${H}` }}
        // MediaRecorder WebM has no duration: seek far once so the browser works it out (the seek bar then works)
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          if (!Number.isFinite(v.duration) && !fixed.current) { fixed.current = true; v.currentTime = 1e7; }
        }}
        onDurationChange={(e) => {
          const v = e.currentTarget;
          if (fixed.current && Number.isFinite(v.duration) && v.currentTime > v.duration - 0.05) { v.currentTime = 0; void v.play().catch(() => {}); }
        }}
      />
      <p className="wa-review__line">
        {(result.ms / 1000).toFixed(1)} s · {(clip.blob.size / 1e6).toFixed(1)} MB · {W}×{H} · {ext}
      </p>
      {converting && <p className="studio-hint" role="status">Making an MP4 (what WhatsApp and Instagram play)… {conv}%</p>}
      {conv === "unavailable" && <p className="studio-hint">This browser can't make MP4, which WhatsApp and Instagram need. Send to video editor makes one, or record in Chrome or Edge.</p>}
      {conv === "failed" && <p className="studio-hint">Couldn't make an MP4 from this take; the WebM is kept. Send to video editor makes one.</p>}
      {result.reason && <p className="studio-hint">{result.reason}</p>}
      {result.fps < 24 && <p className="studio-hint">This machine dropped frames; Render… makes it smooth on any machine.</p>}
      {overrides && <p className="studio-hint">Changes made while recording were for this take only.</p>}
      <div className="wa-review__actions">
        <button type="button" className="studio-btn studio-btn--primary" disabled={converting} onClick={() => { download(clip.blob, name); onSafe(); }}>Download</button>
        {recording && send.state !== "sent" && (
          <button type="button" className="studio-btn" disabled={sending || converting} onClick={() => void sendToEditor()}>
            {sending ? `Sending… ${send.pct}%` : send.state === "failed" ? "Retry" : "Send to video editor"}
          </button>
        )}
        <button type="button" className="studio-btn" disabled={sending} onClick={onRecordAgain}>Record again</button>
        <button type="button" className="studio-btn studio-btn--ghost" disabled={sending} onClick={onDiscard}>Discard</button>
      </div>
      {send.state === "failed" && <p className="studio-hint" role="alert">{send.error} Download still keeps it.</p>}
      {send.state === "sent" && reelLink && (
        <p className="studio-hint">
          Saved to Recordings as {send.path?.split("/").pop() ?? name}.{" "}
          <a className="wa-link" href={reelLink} target="_blank" rel="noopener">Open in video editor</a>
        </p>
      )}
    </div>
  );
}
