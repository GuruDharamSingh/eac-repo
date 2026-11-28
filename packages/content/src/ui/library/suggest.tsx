"use client";

import * as React from "react";
import { Search } from "lucide-react";

// A search box with a suggestions dropdown (Content round 2, 2026-11-26). The ARIA 1.2 combobox pattern:
// the input is the combobox, the dropdown a listbox of options in three groups, focus stays in the input and
// aria-activedescendant names the highlighted option. Arrow keys move, Enter chooses, Escape closes.
// Endpoint: GET <endpoint>?q=&limit=  ->  { pieces:[{key,title,type,cover}], people:[{id,name,avatar}], orgs:[{id,name,logo}] }
// With an empty q only the recent pieces are shown.

export interface SuggestPiece { key: string; title: string; type: string; cover: string | null }
export interface SuggestPerson { id: string; name: string; avatar?: string | null }
export interface SuggestOrg { id: string; name: string; logo?: string | null }
export interface SuggestResult { pieces: SuggestPiece[]; people: SuggestPerson[]; orgs: SuggestOrg[] }

export interface SuggestConfig {
  endpoint: string;
  /** Picking a piece. Default: the text box takes the piece's title. */
  onPiece?: (piece: SuggestPiece) => void;
  /** Picking a person (scope person:<id>). */
  onPerson?: (person: SuggestPerson) => void;
  /** Picking an org (scope org:<id>). */
  onOrg?: (org: SuggestOrg) => void;
}

type Opt = { id: string; group: "Pieces" | "People" | "Orgs"; label: string; img: string | null; pick: () => void };

const EMPTY: SuggestResult = { pieces: [], people: [], orgs: [] };

export function SuggestSearch({ placeholder, value, onChange, suggest, className }: { placeholder: string; value: string; onChange: (v: string) => void; suggest: SuggestConfig; className?: string }) {
  const uid = React.useId();
  const listId = `${uid}-list`;
  const root = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const [res, setRes] = React.useState<SuggestResult>(EMPTY);
  const [active, setActive] = React.useState(-1);

  // Fetch while open: now on focus, then 200 ms after the typing stops.
  React.useEffect(() => {
    if (!open) return;
    const ctl = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const q = value.trim();
        const u = `${suggest.endpoint}${suggest.endpoint.includes("?") ? "&" : "?"}q=${encodeURIComponent(q)}&limit=${q ? 5 : 6}`;
        const r = await fetch(u, { signal: ctl.signal, credentials: "same-origin" });
        if (!r.ok) throw new Error(String(r.status));
        const b = (await r.json()) as Partial<SuggestResult>;
        setRes({ pieces: Array.isArray(b.pieces) ? b.pieces : [], people: q && Array.isArray(b.people) ? b.people : [], orgs: q && Array.isArray(b.orgs) ? b.orgs : [] });
        setActive(-1);
      } catch (e) {
        if ((e as Error)?.name !== "AbortError") {
          setRes(EMPTY);
        }
      }
    }, value.trim() ? 200 : 0);
    return () => {
      window.clearTimeout(t);
      ctl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value, suggest.endpoint]);

  const done = (fn: () => void) => () => {
    setOpen(false);
    setActive(-1);
    fn();
  };
  const opts: Opt[] = [
    ...res.pieces.map((p): Opt => ({ id: `${uid}-p-${p.key}`, group: "Pieces", label: p.title, img: p.cover, pick: done(() => (suggest.onPiece ? suggest.onPiece(p) : onChange(p.title))) })),
    ...res.people.map((p): Opt => ({ id: `${uid}-u-${p.id}`, group: "People", label: p.name, img: p.avatar ?? null, pick: done(() => suggest.onPerson?.(p)) })),
    ...res.orgs.map((o): Opt => ({ id: `${uid}-o-${o.id}`, group: "Orgs", label: o.name, img: o.logo ?? null, pick: done(() => suggest.onOrg?.(o)) })),
  ].filter((o) => o.group === "Pieces" || (o.group === "People" ? suggest.onPerson : suggest.onOrg));
  const groups = (["Pieces", "People", "Orgs"] as const).map((g) => ({ g, list: opts.filter((o) => o.group === g) })).filter((x) => x.list.length);
  const showList = open && (opts.length > 0);

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (!opts.length) return;
      const d = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (a < 0 && d < 0 ? opts.length - 1 : (a + d + opts.length) % opts.length));
    } else if (e.key === "Enter" && showList && active >= 0 && opts[active]) {
      e.preventDefault();
      opts[active]!.pick();
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      setActive(-1);
    }
  };

  return (
    <div
      ref={root}
      className={`eac-c-suggest${className ? ` ${className}` : ""}`}
      onBlur={(e) => {
        if (!root.current?.contains(e.relatedTarget as Node | null)) {
          setOpen(false);
          setActive(-1);
        }
      }}
    >
      <label className="chn-search">
        <Search size={15} aria-hidden />
        <span className="chn-sr">Search</span>
        <input
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-activedescendant={showList && active >= 0 ? opts[active]?.id : undefined}
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKey}
        />
      </label>
      <div id={listId} role="listbox" aria-label="Suggestions" className="eac-c-suggest-list" hidden={!showList}>
        {groups.map(({ g, list }) => (
          <div key={g} role="group" aria-labelledby={`${uid}-g-${g}`}>
            <div id={`${uid}-g-${g}`} className="eac-c-suggest-group" role="presentation">{g}</div>
            {list.map((o) => (
              <div
                key={o.id}
                id={o.id}
                role="option"
                aria-selected={opts[active]?.id === o.id}
                className="eac-c-suggest-opt"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(opts.indexOf(o))}
                onClick={o.pick}
              >
                {o.img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.img} alt="" className="eac-c-suggest-img" data-round={g === "Pieces" ? undefined : "1"} />
                ) : (
                  <span className="eac-c-suggest-img" data-round={g === "Pieces" ? undefined : "1"} aria-hidden />
                )}
                <span className="eac-c-suggest-label">{o.label}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
