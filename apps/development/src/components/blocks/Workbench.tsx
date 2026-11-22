"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Block } from "@elkdonis/blocks";
import type { Config } from "@puckeditor/core";
import type { CatalogEntry, ThemeApp } from "@/lib/types";
import { setScopeApp, setTheme, setThemes, useThemeId } from "@/lib/theme-store";
import { SOURCES } from "@/registry/sources";
import { appRank, buildItems, nodeProps, type Item } from "./model";
import { renderConfigFor, editorConfigFor } from "./configs";
import { Tile } from "./Tile";
import { versionsCounts } from "@/lib/versions-actions";

const BlockSuite = dynamic(() => import("./BlockSuite"), { ssr: false, loading: () => <div className="dev-loading">Opening the editing suite...</div> });

type Loaded = Map<string, { block: Block<never>; app: string }>;

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v as object)
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(v ?? null);
}

export function Workbench({ catalog, themes }: { catalog: CatalogEntry[]; themes: ThemeApp[] }) {
  const [loaded, setLoaded] = useState<Loaded>(() => new Map());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [q, setQ] = useState("");
  const [app, setApp] = useState("all");
  const [only, setOnly] = useState<"all" | "live" | "mock" | "off">("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Record<string, unknown>>>({});
  const [nonce, setNonce] = useState(0);
  // How many saved versions each block has ("block:<app>:<id>" -> n): the badge on the tiles.
  const [vcounts, setVcounts] = useState<Record<string, number>>({});
  const onVersionCount = useCallback((subject: string, n: number) => setVcounts((p) => (p[subject] === n ? p : { ...p, [subject]: n })), []);
  useEffect(() => {
    let alive = true;
    versionsCounts().then((r) => {
      if (alive && r.ok) setVcounts(r.counts);
    }).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const theme = useThemeId();
  const scroller = useRef<HTMLDivElement | null>(null);

  useEffect(() => setThemes(themes), [themes]);

  // Load every registered source, each on its own: a failure is a row, not a crash.
  useEffect(() => {
    let alive = true;
    (async () => {
      for (const s of SOURCES) {
        try {
          const blocks = await s.load();
          if (!alive) return;
          setLoaded((prev) => {
            const next = new Map(prev);
            for (const b of blocks) next.set(b.def.id, { block: b, app: s.app });
            return next;
          });
        } catch (e) {
          if (alive) setErrors((p) => ({ ...p, [s.app]: `Could not load ${s.pkg}: ${e instanceof Error ? e.message : String(e)}` }));
        }
      }
      if (alive) setDone(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const items = useMemo(() => buildItems(catalog, loaded, errors), [catalog, loaded, errors]);
  const blocks = useMemo(() => [...loaded.values()].map((v) => v.block), [loaded]);
  const renderConfig = useMemo<Config | null>(() => (blocks.length ? renderConfigFor(blocks) : null), [blocks]);
  const editorConfig = useMemo<Config | null>(() => (selected && blocks.length ? editorConfigFor(blocks) : null), [selected, blocks]);

  const apps = useMemo(() => [...new Set(items.map((i) => i.entry.app))].sort((a, b) => appRank(a) - appRank(b) || a.localeCompare(b)), [items]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((i) => {
      if (app !== "all" && i.entry.app !== app) return false;
      if (only === "live" && !i.block) return false;
      if (only === "mock" && !i.mock) return false;
      if (only === "off" && (i.block || i.mock)) return false;
      if (!needle) return true;
      const e = i.entry;
      return [e.label, e.id, e.app, e.category, e.description].some((s) => s && s.toLowerCase().includes(needle));
    });
  }, [items, q, app, only]);

  // Columns across the canvas: one per app and category.
  const columns = useMemo(() => {
    const m = new Map<string, { title: string; rank: number; items: Item[] }>();
    for (const i of shown) {
      const cat = i.entry.category ?? "other";
      const k = `${i.entry.app}/${cat}`;
      if (!m.has(k)) m.set(k, { title: `${i.entry.app} / ${cat}`, rank: appRank(i.entry.app), items: [] });
      m.get(k)!.items.push(i);
    }
    return [...m.entries()].sort((a, b) => a[1].rank - b[1].rank || a[0].localeCompare(b[0]));
  }, [shown]);

  const live = items.filter((i) => i.block).length;
  const mocks = items.filter((i) => !i.block && i.mock).length;
  const off = items.length - live - mocks;

  const open = useCallback((key: string) => {
    setScopeApp(key.split(":")[0] ?? null); // the sandbox preview wears the app's scoped sheet, like its tile
    setSelected(key);
  }, []);
  const sel = selected ? items.find((i) => i.entry.key === selected) : undefined;

  // Drag the empty canvas to pan.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let down: { x: number; y: number; l: number; t: number } | null = null;
    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("article,button,input,select,a")) return;
      down = { x: e.clientX, y: e.clientY, l: el.scrollLeft, t: el.scrollTop };
      el.setPointerCapture(e.pointerId);
      el.classList.add("is-panning");
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      el.scrollLeft = down.l - (e.clientX - down.x);
      el.scrollTop = down.t - (e.clientY - down.y);
    };
    const onUp = () => {
      down = null;
      el.classList.remove("is-panning");
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return (
    <div className="dev-bench">
      <div className="dev-toolbar">
        <input type="search" placeholder="Filter blocks" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter blocks" />
        <select value={app} onChange={(e) => setApp(e.target.value)} aria-label="App or package">
          <option value="all">All apps ({items.length})</option>
          {apps.map((a) => (
            <option key={a} value={a}>
              {a} ({items.filter((i) => i.entry.app === a).length})
            </option>
          ))}
        </select>
        <select value={only} onChange={(e) => setOnly(e.target.value as "all" | "live" | "mock" | "off")} aria-label="Show">
          <option value="all">All blocks ({items.length})</option>
          <option value="live">Live, editable ({live})</option>
          <option value="mock">Mock with sample content ({mocks})</option>
          <option value="off">Not drawn yet ({off})</option>
        </select>
        <label className="dev-theme-pick">
          Theme
          <select value={theme ?? ""} onChange={(e) => setTheme(e.target.value || null)} aria-label="Preview theme">
            <option value="">Each block&apos;s own look</option>
            {themes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <span className="dev-count">{done ? `${shown.length} of ${items.length}` : "loading blocks..."}</span>
      </div>
      {Object.values(errors).map((m) => (
        <p key={m} className="dev-error">
          {m}
        </p>
      ))}
      <div
        className="dev-canvas"
        ref={(el) => {
          scroller.current = el;
          if (el !== root) setRoot(el);
        }}
      >
        <div className="dev-columns">
          {columns.map(([k, col]) => (
            <section key={k} className="dev-column">
              <h2>
                {col.title} <small>{col.items.length}</small>
              </h2>
              {col.items.map((i) => (
                <Tile key={i.entry.key} item={i} config={renderConfig} root={root} edits={edits[i.entry.key]} versions={vcounts[`block:${i.entry.key}`]} selected={selected === i.entry.key} onOpen={open} />
              ))}
            </section>
          ))}
          {done && columns.length === 0 ? <p className="dev-empty">No blocks match.</p> : null}
        </div>
      </div>
      {sel?.block && renderConfig && editorConfig ? (
        <BlockSuite
          key={`${sel.entry.key}:${nonce}`}
          block={sel.block}
          blocks={blocks}
          renderConfig={renderConfig}
          editorConfig={editorConfig}
          edits={edits[sel.entry.key]}
          subject={`block:${sel.entry.key}`}
          onVersionCount={onVersionCount}
          onChange={(props) => {
            const base = stable(nodeProps(sel.block!));
            setEdits((prev) => {
              const next = { ...prev };
              if (stable(props) === base) delete next[sel.entry.key];
              else next[sel.entry.key] = props;
              return next;
            });
          }}
          onReset={() => {
            setEdits((prev) => {
              const next = { ...prev };
              delete next[sel.entry.key];
              return next;
            });
            setNonce((n) => n + 1);
          }}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}
