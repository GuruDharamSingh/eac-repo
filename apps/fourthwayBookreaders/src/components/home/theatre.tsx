"use client";

import { useState } from "react";
import type { MeetingRecording } from "@/lib/types";

/**
 * Prior meetings, on video. A stage and a list: pick from the list, the stage
 * plays it. The list is the org's Media/Videos folder in Nextcloud, read
 * server-side and handed in as props — nothing here talks to Nextcloud.
 */
export function Theatre({ recordings }: { recordings: MeetingRecording[] }) {
  const [current, setCurrent] = useState<MeetingRecording | null>(recordings[0] ?? null);

  return (
    <div className="theatre" id="recordings">
      <div className="theatre__stage">
        {current ? (
          <video key={current.url} controls preload="metadata" src={current.url}>
            Your browser can&rsquo;t play this recording.{" "}
            <a href={current.url}>Download it instead.</a>
          </video>
        ) : (
          <div className="theatre__empty">
            No recordings yet. Videos placed in the circle&rsquo;s{" "}
            <code>Media/Videos</code> folder appear here.
          </div>
        )}
      </div>
      <div className="theatre__list" role="listbox" aria-label="Recorded meetings">
        {recordings.length === 0 && (
          <div className="theatre__empty" style={{ textAlign: "left" }}>Nothing recorded yet.</div>
        )}
        {recordings.map((r) => (
          <button
            key={r.id}
            type="button"
            role="option"
            aria-selected={current?.id === r.id}
            data-active={current?.id === r.id}
            className="theatre__item"
            onClick={() => setCurrent(r)}
          >
            {r.title}
            <span>
              {r.recordedAt ? new Date(r.recordedAt).toLocaleDateString("en-CA", { dateStyle: "medium" }) : ""}
              {r.sizeBytes ? ` · ${(r.sizeBytes / 1_048_576).toFixed(0)} MB` : ""}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
