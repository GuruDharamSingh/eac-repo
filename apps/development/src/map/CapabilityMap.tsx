"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Cap } from "@/rails/types";
import { LEVELS, levelOf } from "@/rails/types";
import { LevelTag } from "@/rails/ui";

// Every capability with filters. Cards are drawn 36 at a time, so 800 of them stay quick.

const PAGE = 36;

function appsOf(c: Cap): string[] {
  const out = new Set<string>();
  if (c.address?.app) out.add(c.address.app);
  for (const h of c.hosts) {
    const m = /^apps\/([^/]+)\//.exec(h.file);
    if (m) out.add(m[1]);
  }
  return [...out];
}

function wording(c: Cap): string {
  if (!c.confirm) return c.level >= 3 ? "Confirm card: missing" : "No confirm card (not needed at this level)";
  if (c.confirm.status === "draft") return "Confirm wording: draft, not approved yet";
  if (c.confirm.status === "approved") return "Confirm wording: approved";
  return `Confirm wording: ${c.confirm.status}`;
}

export function CapabilityMap({ caps, courseNames }: { caps: Array<Cap & { hostCount?: number }>; courseNames: Record<string, string> }) {
  const [q, setQ] = useState("");
  const [area, setArea] = useState("");
  const [app, setApp] = useState("");
  const [actor, setActor] = useState("");
  const [level, setLevel] = useState<number | null>(null);
  const [shown, setShown] = useState(PAGE);

  const withApps = useMemo(() => caps.map((c) => ({ c, apps: appsOf(c), hay: `${c.id} ${c.label} ${c.does} ${c.family ?? ""}`.toLowerCase() })), [caps]);
  const areas = useMemo(() => [...new Set(caps.map((c) => c.area))].sort(), [caps]);
  const apps = useMemo(() => [...new Set(withApps.flatMap((w) => w.apps))].sort(), [withApps]);
  const actors = useMemo(() => [...new Set(caps.flatMap((c) => c.actors))].sort(), [caps]);

  // Counts follow every filter except the level one, so the ladder shows what each level would give.
  const base = useMemo(() => {
    const s = q.trim().toLowerCase();
    return withApps.filter((w) => (!s || w.hay.includes(s)) && (!area || w.c.area === area) && (!app || w.apps.includes(app)) && (!actor || w.c.actors.includes(actor)));
  }, [withApps, q, area, app, actor]);
  const counts = useMemo(() => {
    const o: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const w of base) o[w.c.level]++;
    return o;
  }, [base]);
  const list = useMemo(() => (level === null ? base : base.filter((w) => w.c.level === level)), [base, level]);
  const filtered = Boolean(q || area || app || actor);

  const reset = (fn: () => void) => {
    fn();
    setShown(PAGE);
  };

  return (
    <div>
      <div className="dev-r-lv-btns" role="group" aria-label="Filter by level">
        {LEVELS.map((l) => (
          <button key={l.n} className={`dev-r-lvbtn${level === l.n ? " is-on" : ""}`} style={{ ["--lv" as string]: l.color }} onClick={() => reset(() => setLevel(level === l.n ? null : l.n))} aria-pressed={level === l.n} title={l.means}>
            {l.name} <b>{counts[l.n]}</b>
          </button>
        ))}
        <span className="dev-r-muted" style={{ alignSelf: "center", fontSize: 12 }}>
          {filtered ? `${base.length} of ${caps.length} match your filters` : `${caps.length} in all`}
        </span>
      </div>
      <div className="dev-r-filters">
        <input className="dev-r-input" type="search" placeholder="Search by name or what it does" value={q} onChange={(e) => reset(() => setQ(e.target.value))} aria-label="Search" />
        <select className="dev-r-select" value={area} onChange={(e) => reset(() => setArea(e.target.value))} aria-label="Area">
          <option value="">Every area</option>
          {areas.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <select className="dev-r-select" value={app} onChange={(e) => reset(() => setApp(e.target.value))} aria-label="App">
          <option value="">Every app</option>
          {apps.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <select className="dev-r-select" value={actor} onChange={(e) => reset(() => setActor(e.target.value))} aria-label="Who does it">
          <option value="">Anyone who does it</option>
          {actors.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        {filtered || level !== null ? (
          <button
            className="dev-r-btn is-quiet"
            onClick={() =>
              reset(() => {
                setQ("");
                setArea("");
                setApp("");
                setActor("");
                setLevel(null);
              })
            }
          >
            Clear filters
          </button>
        ) : null}
        <span className="dev-r-muted" style={{ marginLeft: "auto", fontSize: 12 }}>
          Showing {Math.min(shown, list.length)} of {list.length}
        </span>
      </div>

      <div className="dev-r-grid">
        {list.slice(0, shown).map(({ c }) => (
          <article key={c.id} className="dev-r-cap" style={{ ["--lv" as string]: levelOf(c.level).color }} data-dev-anchor={`cap:${c.id}`}>
            <header>
              <div>
                <h3>{c.label}</h3>
                <span className="id">{c.id}</span>
              </div>
              <LevelTag n={c.level} where={c.where} />
            </header>
            <p>{c.does}</p>
            <p>
              <span className="k">Why it is at {levelOf(c.level).name}: </span>
              {c.why}
            </p>
            <p>
              <span className="k">What lifts it: </span>
              {c.next}
            </p>
            <p>
              <span className="k">Done at: </span>
              {c.address ? (
                <>
                  {c.address.app} <code>{c.address.path}</code>
                  {c.address.how ? ` (${c.address.how})` : ""}
                </>
              ) : (
                "nowhere yet"
              )}
            </p>
            <p>
              <span className="k">Runs as: </span>
              {c.entry ?? "no runnable entry"}
              {c.dockForm ? `, form ${c.dockForm}` : ""}
              {c.status ? `; check: ${c.status}` : "; no status check"}
            </p>
            <p>
              <span className="k">{wording(c)}</span>
            </p>
            {c.open ? <p className="dev-r-open">Open question: {c.open}</p> : null}
            {c.hosts.length ? (
              <ul>
                {c.hosts.map((h, i) => (
                  <li key={i}>
                    {h.file}
                    {h.line ? `:${h.line}` : ""}
                  </li>
                ))}
                {(c.hostCount ?? c.hosts.length) > c.hosts.length ? <li>and {(c.hostCount ?? 0) - c.hosts.length} more</li> : null}
              </ul>
            ) : null}
            <div className="dev-r-pills">
              <span className="dev-r-pill">{c.area}</span>
              {c.actors.map((a) => (
                <span key={a} className="dev-r-pill">
                  {a}
                </span>
              ))}
              {c.risk.map((r) => (
                <span key={r} className={`dev-r-pill${r === "money" ? " is-money" : ""}`}>
                  risk: {r}
                </span>
              ))}
              {c.courses.map((id) => (
                <Link key={id} href={`/rails/${id}`} className="dev-r-pill dev-r-link">
                  {courseNames[id] ?? id}
                </Link>
              ))}
            </div>
          </article>
        ))}
      </div>
      {list.length === 0 ? <p className="dev-r-muted" style={{ marginTop: 16 }}>Nothing matches these filters.</p> : null}
      {shown < list.length ? (
        <p style={{ marginTop: 16 }}>
          <button className="dev-r-btn" onClick={() => setShown((s) => s + PAGE * 2)}>
            Show {Math.min(PAGE * 2, list.length - shown)} more
          </button>
        </p>
      ) : null}
    </div>
  );
}
