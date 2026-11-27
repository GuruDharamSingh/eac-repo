"use client";

import { useState } from "react";
import "./workspace.css";

const DEFAULT_CONSENT = [
  "This is an experiment, and you are taking part because you want to.",
  "What you will do: take part in the sessions and write down what you notice each time, as asked.",
  "What we keep: what you write here is kept by the guides of this experiment. By default only the group and the guides read it; nobody outside does.",
  "Publishing: results may be written up and published at the end. Nothing of yours is included unless you agree to that one entry, and you choose whether your name is shown.",
  "You can stop at any time. If you withdraw, you can no longer add entries, and what you wrote is taken out of any results that are not yet published.",
].join("\n\n");

/**
 * Make a workspace: the prototype's NewWorkshopSheet (four questions) in the same dark look, for the owners and guides of an
 * organisation. It posts to /api/workspaces/workspace-create and lands in the new workspace, in Editing mode.
 */
export function NewWorkspaceForm({ orgs }: { orgs: { id: string; name: string }[] }) {
  const [orgId, setOrgId] = useState(orgs[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [line, setLine] = useState("");
  const [when, setWhen] = useState("");
  const [where, setWhere] = useState<"In person" | "Online" | "Both">("In person");
  const [sessions, setSessions] = useState(6);
  const [ongoing, setOngoing] = useState(false);
  const [experiment, setExperiment] = useState(false);
  const [consent, setConsent] = useState(DEFAULT_CONSENT);
  const [visibility, setVisibility] = useState<"private" | "unlisted">("private");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/workspaces/workspace-create", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ orgId, title, line, when, where, sessions: ongoing || experiment ? 1 : Math.max(1, sessions), ongoing: ongoing || experiment, experiment, consentText: experiment ? consent : undefined, visibility: experiment ? "private" : visibility }),
      });
      const j = (await res.json()) as { ok: boolean; error?: string; slug?: string };
      if (j.ok && j.slug) { window.location.href = `/workspaces/${j.slug}`; return; }
      setError(j.error ?? "That could not be made. Nothing was kept.");
    } catch {
      setError("That did not work. Check your connection and try again.");
    }
    setBusy(false);
  };

  return (
    <div className="ws-root ws-start">
      <form className="ws-start-card" onSubmit={submit} aria-label="New workspace">
        <h1>New workspace</h1>
        {orgs.length > 1 ? (
          <label className="ws-q">
            <span>For which organisation?</span>
            <select className="ws-select" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
        ) : null}
        <label className="ws-q">
          <span>What is it called?</span>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Clay and Breath" maxLength={160} />
        </label>
        <label className="ws-q">
          <span>Say it in one line</span>
          <input value={line} onChange={(e) => setLine(e.target.value)} placeholder="Six evenings of slow hand-building." maxLength={200} />
        </label>
        <label className="ws-q">
          <span>When does it start?</span>
          <input value={when} onChange={(e) => setWhen(e.target.value)} placeholder="Thu 14 Jan, 7:00 pm" />
          <small>A date like 14 Jan lets the sessions be dated weekly.</small>
        </label>
        <fieldset className="ws-q">
          <legend>Where?</legend>
          <div className="ws-seg">
            {(["In person", "Online", "Both"] as const).map((o) => (
              <button key={o} type="button" className="ws-mode" aria-pressed={where === o} onClick={() => setWhere(o)}>{o}</button>
            ))}
          </div>
        </fieldset>
        <fieldset className="ws-q">
          <legend>How many sessions?</legend>
          <div className="ws-seg">
            <button type="button" className="ws-mode" aria-pressed={!ongoing && !experiment} onClick={() => { setOngoing(false); setExperiment(false); }}>A number of sessions</button>
            <button type="button" className="ws-mode" aria-pressed={ongoing && !experiment} onClick={() => { setOngoing(true); setExperiment(false); }}>Ongoing (no end date)</button>
            <button type="button" className="ws-mode" aria-pressed={experiment} onClick={() => { setExperiment(true); setOngoing(true); }}>Experiment</button>
          </div>
          {experiment ? <small>An experiment: a daily test log, a closed circle (invite only), and a consent text people agree to before they take part. Results can be published at the end, only with each writer&apos;s agreement.</small> : null}
          {experiment ? null : ongoing ? <small>One ongoing session with a step that repeats every day. You can add more later.</small> : (
            <input type="number" aria-label="Number of sessions" min={1} max={24} value={sessions} onChange={(e) => setSessions(Number(e.target.value))} />
          )}
        </fieldset>
        {experiment ? (
          <label className="ws-q">
            <span>What people agree to before they take part</span>
            <textarea className="ws-sh-input" rows={10} value={consent} onChange={(e) => setConsent(e.target.value)} />
            <small>Written in plain words. People read it and agree before they can write or read anything. You can change it later; a change asks everyone to agree again.</small>
          </label>
        ) : null}
        {experiment ? null : <fieldset className="ws-q">
          <legend>Who can find it?</legend>
          <div className="ws-seg">
            <button type="button" className="ws-mode" aria-pressed={visibility === "private"} onClick={() => setVisibility("private")}>Private</button>
            <button type="button" className="ws-mode" aria-pressed={visibility === "unlisted"} onClick={() => setVisibility("unlisted")}>Anyone with the link</button>
          </div>
          <small>Either way, people join only when you add them or send an invite link.</small>
        </fieldset>}
        {error ? <p role="alert" className="ws-muted">{error}</p> : null}
        <div className="ws-row">
          <button type="submit" className="ws-btn ws-btn-primary" disabled={!title.trim() || busy}>{busy ? "Making it…" : "Create workspace"}</button>
          <a className="ws-btn" href="/workspaces">Cancel</a>
        </div>
      </form>
    </div>
  );
}
