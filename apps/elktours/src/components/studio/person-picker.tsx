"use client";

import { FieldLabel } from "@puckeditor/core";
import { useEffect, useRef, useState } from "react";
import { mountRecordChooser } from "@elkdonis/direct-edit/puck";
import { records } from "@/components/landing/person-records";

/**
 * A reference prop in Puck Studio's right panel (2026-11-06): "Who" for a Featured person, "Opens" and a Card's
 * "Filled from" — the same "From what?" chooser as the canvas editor, drawn in the panel. Stores the reference only;
 * Puck's resolver draws what it names.
 */
export function PersonPickerField({
  value,
  onChange,
  readOnly,
  field,
  binds = "person",
}: {
  value?: unknown;
  onChange: (v: string) => void;
  readOnly?: boolean;
  field?: { label?: string };
  /** The prop's `binds`: person, opens or record. */
  binds?: string;
}) {
  const current = typeof value === "string" ? value : "";
  const [open, setOpen] = useState(false);
  const [words, setWords] = useState<string>(current ? "…" : "Not chosen yet.");
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    if (!current) { setWords("Not chosen yet."); return; }
    records.resolve(binds, current).then(
      (drawn) => live && setWords(records.describe(binds, current, drawn)),
      () => live && setWords(records.describe(binds, current, null)),
    );
    return () => { live = false; };
  }, [current, binds]);

  useEffect(() => {
    if (!open || !host.current) return;
    return mountRecordChooser(host.current, {
      records,
      binds,
      value: current,
      onPick(v) { setOpen(false); onChange(v); },
    });
  }, [open, current, onChange, binds]);

  return (
    <FieldLabel label={field?.label ?? "Who"} el="div">
      <p style={{ margin: "0 0 8px", fontSize: 12, lineHeight: 1.4 }} data-person-now="">{words}</p>
      {!readOnly && (
        <button type="button" data-person-open="" onClick={() => setOpen((o) => !o)} style={{ font: "inherit", fontSize: 13, padding: "6px 12px", border: "1px solid #aab1b8", borderRadius: 6, background: "#fff", cursor: "pointer" }}>
          {open ? "Close" : current ? "Change…" : "Choose…"}
        </button>
      )}
      {open && <div ref={host} className="de-person-chooser" style={{ marginTop: 10, maxHeight: 380, overflow: "auto", font: "13px/1.4 system-ui, sans-serif" }} />}
    </FieldLabel>
  );
}
