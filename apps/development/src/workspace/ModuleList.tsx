"use client";

import { useWorkspace } from "./store";
import { readable } from "./Field";

export function ModuleList() {
  const w = useWorkspace();
  const c = w.course;
  if (!c) return null;
  const shared = w.mode !== "participant" || c.journals !== "private";
  return (
    <nav className="ws-list" aria-label="Sections">
      <h2 className="ws-list-h">Sections</h2>
      <button type="button" className="ws-item" aria-current={w.selected === "overview" ? "page" : undefined} onClick={() => w.select("overview")}>
        <span className="ws-item-t">Overview</span>
      </button>
      {c.modules.map((m, i) => {
        const filled = m.fill.row;
        const ink = filled ? readable(m.colour).ink : undefined;
        return (
          <button
            key={m.id} type="button" className={`ws-item${filled ? " ws-item-filled" : ""}`}
            style={{ ["--ws-module" as string]: m.colour, ...(filled ? { background: m.colour, color: ink } : {}) }}
            aria-current={w.selected === m.id ? "page" : undefined}
            onClick={() => w.select(m.id)}
          >
            <span className="ws-item-t">{i + 1} · {m.title}</span>
            {m.date ? <span className="ws-item-d">{m.date.split(",")[0]}</span> : null}
          </button>
        );
      })}
      {w.mode === "edit" ? <button type="button" className="ws-item ws-item-add" onClick={() => w.addModule()}>+ Add session</button> : null}
      <div className="ws-list-foot">
        <button type="button" className="ws-item" aria-current={w.sheet === "journal" ? "true" : undefined} onClick={() => w.setSheet("journal")}>
          <span className="ws-item-t">Journal</span>
        </button>
        {shared ? (
          <button type="button" className="ws-item" aria-current={w.frame === "journal" ? "true" : undefined} onClick={() => w.setFrame("journal")}>
            <span className="ws-item-t">Concurrent journals</span>
          </button>
        ) : null}
        <button type="button" className="ws-item" aria-current={w.selected === "settings" ? "page" : undefined} onClick={() => w.select("settings")}>
          <span className="ws-item-t">Settings</span>
        </button>
      </div>
    </nav>
  );
}
