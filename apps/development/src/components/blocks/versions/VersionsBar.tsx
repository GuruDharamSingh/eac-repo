"use client";

import { useState, type CSSProperties } from "react";
import { isFail, nextBranchName, startsBranch } from "@/lib/versions-types";
import type { VersionsApi } from "./useVersions";
import { whenText } from "./History";

// The sandbox header's part of versions: "Save version" (with an optional note),
// "History", a one-line status for the autosaved working copy, and a clear
// "not set up yet" state when the database table does not exist.

const BTN: CSSProperties = { font: "500 13px/1 system-ui, sans-serif", padding: "8px 12px", borderRadius: 6, cursor: "pointer", border: "1px solid #1d2129", background: "#fff", color: "#1d2129" };
const PRIMARY: CSSProperties = { ...BTN, background: "#0f766e", borderColor: "#0f766e", color: "#fff" };
const INPUT: CSSProperties = { font: "13px system-ui", padding: "7px 8px", border: "1px solid #98a2b3", borderRadius: 6, width: "100%", boxSizing: "border-box", color: "#1d2129", background: "#fff" };

export function VersionsBar({ api, getDoc, onHistory }: { api: VersionsApi; getDoc(): unknown; onHistory(): void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (api.phase === "setup" || api.phase === "error" || api.phase === "denied") {
    return (
      <span style={{ font: "500 12px system-ui", color: "#92400e", maxWidth: 260 }} title={api.message}>
        {api.phase === "setup" ? "Versions are not set up yet (the database table is still to be created)." : "Versions are unavailable right now."}
      </span>
    );
  }

  const branching = startsBranch(api.versions, api.baseId);
  const used = [...new Set(api.versions.map((v) => v.branch))];
  const from = api.baseId ? api.versions.find((v) => v.id === api.baseId) : undefined;

  const begin = () => {
    setNote("");
    setName(nextBranchName(used));
    setErr("");
    setOpen((o) => !o);
  };

  const submit = async () => {
    setBusy(true);
    setErr("");
    const r = await api.save({ note: note.trim(), doc: getDoc(), branchName: branching ? name : undefined });
    setBusy(false);
    if (!isFail(r)) setOpen(false);
    else {
      if (r.reason === "needs-name" && r.suggested) setName(r.suggested);
      setErr(r.message);
    }
  };

  const status =
    api.autosave === "waiting" || api.autosave === "saving"
      ? "Saving working copy..."
      : api.autosave === "saved" && api.savedAt
        ? `Working copy saved ${whenText(api.savedAt)}`
        : api.autosave === "failed"
          ? "Working copy not saved"
          : from
            ? `From: ${from.note || "a saved version"} (${from.branch})`
            : "";

  return (
    <>
      {status ? (
        <span style={{ font: "12px system-ui", color: api.autosave === "failed" ? "#b42318" : "#667085", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={status}>
          {status}
        </span>
      ) : null}
      <button type="button" style={PRIMARY} onClick={begin}>
        Save version
      </button>
      <button type="button" style={BTN} onClick={onHistory} disabled={api.phase === "loading"}>
        History{api.versions.length ? ` (${api.versions.length})` : ""}
      </button>
      {open ? (
        <div role="dialog" aria-label="Save version" style={{ position: "fixed", top: 108, right: 24, zIndex: 80, width: 320, background: "#fff", border: "1px solid #98a2b3", borderRadius: 8, boxShadow: "0 12px 32px rgba(0,0,0,0.25)", padding: 14, display: "grid", gap: 10, color: "#1d2129" }}>
          <strong style={{ font: "600 14px system-ui" }}>Save this as a version</strong>
          <label style={{ font: "500 12px system-ui", display: "grid", gap: 4 }}>
            Note (optional): what did you change?
            <input style={INPUT} value={note} maxLength={280} autoFocus placeholder="e.g. Warmer title, bigger photo" onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !busy && void submit()} />
          </label>
          {branching ? (
            <label style={{ font: "500 12px system-ui", display: "grid", gap: 4 }}>
              {from ? `"${from.note || "That version"}" already has a later version, so this starts a new branch.` : "Something is already saved, so this starts a new branch."} Name it:
              <input style={INPUT} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
            </label>
          ) : (
            <span style={{ font: "12px system-ui", color: "#667085" }}>Continues the branch &ldquo;{from?.branch ?? "Main"}&rdquo;. Earlier versions are never overwritten.</span>
          )}
          {err ? <span style={{ font: "12px system-ui", color: "#b42318" }}>{err}</span> : null}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" style={BTN} onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="button" style={PRIMARY} disabled={busy || (branching && !name.trim())} onClick={() => void submit()}>
              {busy ? "Saving..." : "Save version"}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Shown when the sandbox opens and an autosaved working copy from an earlier visit exists. */
export function FoundCopy({ api, onPickUp }: { api: VersionsApi; onPickUp(): void }) {
  const d = api.found;
  if (!d) return null;
  const base = d.baseId ? api.versions.find((v) => v.id === d.baseId) : undefined;
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 14px", background: "#ecfdf3", borderBottom: "1px solid #a6f4c5", font: "13px system-ui", color: "#1d2129" }}>
      <span>
        You have a working copy from {whenText(d.updatedAt)}
        {base ? `, started from "${base.note || "a saved version"}"` : ""}.
      </span>
      <button type="button" style={{ ...BTN, padding: "6px 10px" }} onClick={onPickUp}>
        Pick it up
      </button>
      <button type="button" style={{ ...BTN, padding: "6px 10px" }} onClick={() => void api.dropFound()}>
        Start from the block instead
      </button>
    </div>
  );
}
