"use client";
import { useEffect, useState } from "react";
import { useWorkspace } from "../store";
import type { CandidateWire, ResultWire } from "../types";
import { Frame } from "../Frame";
import "../sheet/sheet.css";

const day = (iso: string) => iso.slice(0, 10);

/** Shown instead of the workspace to a seated person who has not agreed (or must agree again): the consent text, and nothing of the group's. */
export function ConsentScreen({ title, text, version, slug, again }: { title: string; text: string; version: number; slug: string; again: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const agree = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/workspaces/experiment-agree", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ course: slug }) });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (j.ok) { window.location.reload(); return; }
      setError(j.error ?? "That did not work.");
    } catch { setError("That did not work. Check your connection and try again."); }
    setBusy(false);
  };
  return (
    <div className="ws-root ws-start">
      <div className="ws-start-card" role="region" aria-label="Consent to take part">
        <h1>{title}</h1>
        <p className="ws-muted">{again ? "The wording below has changed (version " + version + "). Please read it and agree again to carry on." : "This is an experiment. Before you take part, please read this and agree."}</p>
        <div className="ws-sh-body" style={{ whiteSpace: "pre-wrap" }}>{text}</div>
        {error ? <p role="alert" className="ws-muted">{error}</p> : null}
        <div className="ws-row">
          <button type="button" className="ws-btn ws-btn-primary" disabled={busy} onClick={agree}>I agree and want to take part</button>
          <a className="ws-btn" href="/workspaces">Not now</a>
        </div>
        <p className="ws-muted">You can withdraw at any time from the workspace. Nothing of yours is published without your agreement to that one entry.</p>
      </div>
    </div>
  );
}

/** In the sheet: this person's consent (view the text, withdraw), what the guides have asked to publish, and published results. */
export function ExperimentSheet() {
  const w = useWorkspace();
  const x = w.server?.experiment;
  const [notes, setNotes] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  if (!x || !x.state) return null;
  const s = x.state;
  const given = s.consent.mine && !s.consent.mine.withdrawnAt;
  return (
    <>
      {s.published.length > 0 ? (
        <Frame title="Results" collapsible storeKey="exp-results" label="Results">
          <ul className="ws-sh-list">
            {s.published.map((p) => <li key={p.id}>{p.href ? <a href={p.href}>{p.title}</a> : p.title} <span className="ws-sh-meta">published {day(p.publishedAt)}</span></li>)}
          </ul>
        </Frame>
      ) : null}
      {!s.isGuide && s.requests.length > 0 ? (
        <Frame title="Asked to publish" collapsible storeKey="exp-asked" label="Asked to publish">
          <p className="ws-sh-meta">The guides would like to include these entries in published results. Nothing goes in unless you agree, and you choose whether your name is shown.</p>
          <ul className="ws-sh-list">
            {s.requests.filter((r) => r.state !== "withdrawn").map((r) => (
              <li key={r.itemId} className="ws-ro-entered">
                <div className="ws-sh-body">{r.body.slice(0, 280)}{r.body.length > 280 ? "…" : ""}</div>
                <p className="ws-sh-meta">For “{r.resultTitle || "results"}” · {r.state === "agreed" ? `You agreed (${r.credit === "named" ? "named" : "anonymous"})` : r.state === "declined" ? "You declined" : "Waiting for you"}</p>
                <div className="ws-sh-row">
                  <button type="button" className={"ws-sh-btn" + (r.state === "agreed" && r.credit === "named" ? " ws-sh-primary" : "")} onClick={async () => setErr(await x.decide(r.itemId, true, "named"))} aria-pressed={r.state === "agreed" && r.credit === "named"}>Agree, show my name</button>
                  <button type="button" className={"ws-sh-btn" + (r.state === "agreed" && r.credit === "anonymous" ? " ws-sh-primary" : "")} onClick={async () => setErr(await x.decide(r.itemId, true, "anonymous"))} aria-pressed={r.state === "agreed" && r.credit === "anonymous"}>Agree, anonymously</button>
                  <button type="button" className="ws-sh-btn ws-sh-btn-quiet" onClick={async () => setErr(await x.decide(r.itemId, false))} aria-pressed={r.state === "declined"}>No</button>
                </div>
              </li>
            ))}
          </ul>
          {err ? <p role="alert" className="ws-sh-meta">{err}</p> : null}
        </Frame>
      ) : null}
      {!s.isGuide && s.consent.text ? (
        <Frame title="Your consent" collapsible storeKey="exp-consent" label="Your consent">
          <p className="ws-sh-meta">{given ? `You agreed on ${day(s.consent.mine!.givenAt)} to version ${s.consent.mine!.version}.` : "You have not agreed (or you withdrew)."}</p>
          <details>
            <summary>Read the wording (version {s.consent.text.version})</summary>
            <div className="ws-sh-body" style={{ whiteSpace: "pre-wrap" }}>{s.consent.text.body}</div>
          </details>
          {given ? (
            <button type="button" className="ws-sh-btn ws-sh-btn-quiet" onClick={async () => {
              if (!window.confirm("Withdraw from this experiment? You will not be able to add more entries, and your entries will be taken out of any results.")) return;
              const r = await x.withdraw();
              setErr(r.error ?? null); setNotes(r.notes ?? []);
              if (!r.error) window.location.reload();
            }}>Withdraw from the experiment</button>
          ) : null}
          {notes.map((n, i) => <p key={i} className="ws-sh-meta" role="status">{n}</p>)}
        </Frame>
      ) : null}
    </>
  );
}

/** Settings > Experiment: the consent wording (versioned). */
export function ExperimentSettings() {
  const w = useWorkspace();
  const x = w.server?.experiment;
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const body = x?.state?.consent.text?.body ?? "";
  useEffect(() => { setText(body); }, [body]);
  if (!x) return null;
  const version = x.state?.consent.text?.version;
  return (
    <section aria-label="Experiment">
      <h2 className="ws-h2">Experiment</h2>
      <p className="ws-muted">People take part only after they agree to this wording. If you change it, it becomes a new version and everyone must agree to it again before they can write or read the group&apos;s entries.</p>
      <label className="ws-q">
        <span>Consent wording{version ? ` (now version ${version})` : ""}</span>
        <textarea className="ws-sh-input" rows={14} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <div className="ws-row">
        <button type="button" className="ws-btn ws-btn-primary" disabled={!text.trim() || text.trim() === body.trim()} onClick={async () => {
          if (!window.confirm("Save this as a new version? Everyone will need to agree to it again.")) return;
          const r = await x.saveConsent(text); setMsg(r.error ?? `Saved as version ${r.version}.`); await x.refresh();
        }}>Save as a new version</button>
        {msg ? <span role="status" className="ws-muted">{msg}</span> : null}
      </div>
    </section>
  );
}

/** Settings > Results: compile results from SHARED entries, each only with its writer's agreement, then publish. */
export function ResultsSettings({ orgName }: { orgName: string }) {
  const w = useWorkspace();
  const x = w.server?.experiment;
  const [results, setResults] = useState<ResultWire[] | null>(null);
  const [cands, setCands] = useState<CandidateWire[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({ id: "", title: "", intro: "", conclusion: "", audience: "members" as "members" | "everyone" });
  const load = async (rid?: string) => {
    if (!x) return;
    const r = await x.loadResults(rid);
    if (!r) { setMsg("Results are not available."); return; }
    setResults(r.results); setCands(r.candidates);
    const d = r.results.find((q) => q.id === (rid ?? form.id)) ?? r.results.find((q) => q.status === "draft");
    if (d && d.id !== form.id) setForm({ id: d.id, title: d.title, intro: d.intro, conclusion: d.conclusion, audience: d.audience });
  };
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!x) return null;
  const draft = results?.find((r) => r.id === form.id && r.status === "draft") ?? null;
  const live = (results ?? []).filter((r) => r.status === "published");
  const agreed = draft?.items.filter((i) => i.state === "agreed").length ?? 0;
  const save = async () => { const r = await x.saveResult(form); if (r.error) setMsg(r.error); else { setMsg("Saved."); setForm((f) => ({ ...f, id: r.id ?? f.id })); await load(r.id); } return r; };
  return (
    <section aria-label="Results">
      <h2 className="ws-h2">Results</h2>
      <p className="ws-muted">Pick shared entries to ask their writers about. A writer has to agree to each entry, and chooses whether their name is shown. Only agreed entries are ever published. Entries marked Only me or Private never appear here.</p>
      {live.map((p) => (
        <p key={p.id} role="status">Published: <strong>{p.title}</strong> ({p.audience === "everyone" ? "public" : "members"}) · {p.publishedAt ? day(p.publishedAt) : ""}{" "}
          <button type="button" className="ws-linkbtn" onClick={async () => { if (!window.confirm("Take these results down? The post is removed from view.")) return; const e = await x.takedown(p.id); setMsg(e ?? "Taken down."); await load(); }}>Take down</button>
          {p.items.some((i) => i.state === "withdrawn") ? <span className="ws-muted"> · some writers withdrew; the post was updated without their entries</span> : null}
        </p>
      ))}

      <h3 className="ws-h3">Draft</h3>
      <label className="ws-q"><span>Title</span><input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
      <label className="ws-q"><span>Introduction</span><textarea className="ws-sh-input" rows={4} value={form.intro} onChange={(e) => setForm({ ...form, intro: e.target.value })} /></label>
      <label className="ws-q"><span>Conclusion</span><textarea className="ws-sh-input" rows={4} value={form.conclusion} onChange={(e) => setForm({ ...form, conclusion: e.target.value })} /></label>
      <div className="ws-row"><button type="button" className="ws-btn" onClick={save}>{form.id ? "Save the draft" : "Start a draft"}</button></div>

      {form.id ? (
        <>
          <h3 className="ws-h3">Shared entries</h3>
          {cands.length === 0 ? <p className="ws-muted">No shared entries yet.</p> : (
            <ul className="ws-materials">
              {cands.map((c) => (
                <li key={c.responseId} className="ws-material">
                  <input type="checkbox" aria-label={`Ask ${c.writer} about this entry`} disabled={c.itemState === "agreed" || c.itemState === "requested"} checked={picked.has(c.responseId) || c.itemState === "agreed" || c.itemState === "requested"}
                    onChange={(e) => { const n = new Set(picked); if (e.target.checked) n.add(c.responseId); else n.delete(c.responseId); setPicked(n); }} />
                  <span className="ws-material-name"><strong>{c.writer}</strong> · {day(c.at)} · {c.body.slice(0, 90)}{c.body.length > 90 ? "…" : ""}</span>
                  {c.itemState ? <span className="ws-badge">{c.itemState === "requested" ? "asked" : c.itemState}</span> : null}
                </li>
              ))}
            </ul>
          )}
          <div className="ws-row">
            <button type="button" className="ws-btn" disabled={picked.size === 0} onClick={async () => { const r = await x.request(form.id, [...picked]); setMsg(r.error ?? `Asked ${r.requested} writer${r.requested === 1 ? "" : "s"}.`); setPicked(new Set()); await load(form.id); }}>Ask the writers about {picked.size} {picked.size === 1 ? "entry" : "entries"}</button>
          </div>
          {draft && draft.items.length > 0 ? (
            <>
              <h3 className="ws-h3">Where each one stands</h3>
              <ul className="ws-materials">
                {draft.items.map((i) => (
                  <li key={i.id} className="ws-material">
                    <span className="ws-material-name">{i.writer} · {i.body ? i.body.slice(0, 70) : "(not shown)"}</span>
                    <span className="ws-badge">{i.state === "requested" ? "waiting" : i.state}{i.state === "agreed" ? ` (${i.credit === "named" ? "named" : "anonymous"})` : ""}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <fieldset className="ws-q">
            <legend>Who can read it once published?</legend>
            <label className="ws-check ws-set-opt"><input type="radio" name="ws-res-aud" checked={form.audience === "members"} onChange={() => setForm({ ...form, audience: "members" })} /><span><strong>Members of {orgName}</strong><br /><span className="ws-muted">Shown to the organisation&apos;s members only.</span></span></label>
            <label className="ws-check ws-set-opt"><input type="radio" name="ws-res-aud" checked={form.audience === "everyone"} onChange={() => setForm({ ...form, audience: "everyone" })} /><span><strong>Everyone</strong><br /><span className="ws-muted">This will appear on {orgName}&apos;s public pages, in its feeds, the forum and search.</span></span></label>
          </fieldset>
          <div className="ws-row">
            <button type="button" className="ws-btn ws-btn-primary" disabled={agreed === 0 || !form.title.trim()} onClick={async () => {
              const s = await save();
              if (s.error) return;
              const ok = window.confirm(form.audience === "everyone"
                ? `Publish? This will appear on ${orgName}'s public pages, with ${agreed} agreed ${agreed === 1 ? "entry" : "entries"}.`
                : `Publish to the members of ${orgName}, with ${agreed} agreed ${agreed === 1 ? "entry" : "entries"}?`);
              if (!ok) return;
              const r = await x.publish(form.id); setMsg(r.error ?? `Published with ${r.included} ${r.included === 1 ? "entry" : "entries"}.`); await load();
            }}>Publish</button>
            {agreed === 0 ? <span className="ws-muted">Nothing can be published until a writer has agreed to an entry.</span> : null}
          </div>
        </>
      ) : null}
      {msg ? <p role="status" className="ws-muted">{msg}</p> : null}
    </section>
  );
}
