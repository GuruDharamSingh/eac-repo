"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CoverFramer, MediaPicker, type CoverFrame } from "@elkdonis/cms-ui/files";
import "@elkdonis/cms-ui/files-card.css";
import { saveBanner } from "@/lib/banner-actions";

/**
 * "Change banner" on the landing page, for owners and guides: upload or pick a
 * picture and drag it into the banner's shape. Framing keeps the whole file and
 * stores a focal point and zoom, so the same picture fits a wide screen and a phone.
 */
export function BannerEditor({ url, alt, frame }: { url: string | null; alt: string; frame: CoverFrame | null }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [picture, setPicture] = useState(url ?? "");
  const [words, setWords] = useState(alt);
  const [framing, setFraming] = useState<CoverFrame | null>(frame);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function save(next: string | null) {
    setProblem(null);
    startSaving(async () => {
      const res = await saveBanner({ url: next, alt: words, frame: next ? framing : null });
      if (!res.ok) {
        setProblem(res.error ?? "The banner could not be saved.");
        return;
      }
      if (!next) setPicture("");
      dialog.current?.close();
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" className="pts-banner__edit" onClick={() => dialog.current?.showModal()}>
        Change banner
      </button>
      <dialog ref={dialog} className="pts-dialog" aria-labelledby="pts-banner-h">
        <h2 id="pts-banner-h">Landing banner</h2>
        <MediaPicker
          value={picture}
          onChange={(next) => {
            setPicture(next);
            setFraming(null);
          }}
          uploadEndpoint="/api/media/upload"
          libraryEndpoint="/api/media/library"
          accept="image/*"
          preview="none"
          label="Picture"
        />
        {picture && (
          <CoverFramer
            src={picture}
            frame={framing}
            onChange={setFraming}
            shape={{ label: "Wide screen", aspect: 21 / 8 }}
            alsoShapes={[{ label: "Phone", aspect: 4 / 3 }]}
          />
        )}
        <label className="pts-dialog__field">
          <span>Describe the picture for people who cannot see it</span>
          <input value={words} onChange={(e) => setWords(e.target.value)} maxLength={300} />
        </label>
        {problem && <p role="alert" className="pts-dialog__problem">{problem}</p>}
        <div className="pts-dialog__actions">
          {url && (
            <button type="button" className="ifs-btn" disabled={saving} onClick={() => save(null)}>
              Remove picture
            </button>
          )}
          <button type="button" className="ifs-btn" onClick={() => dialog.current?.close()}>
            Cancel
          </button>
          <button type="button" className="ifs-btn ifs-btn--primary" disabled={saving || !picture} onClick={() => save(picture)}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </dialog>
    </>
  );
}
