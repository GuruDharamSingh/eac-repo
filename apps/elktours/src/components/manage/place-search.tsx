"use client";

import { useEffect, useRef, useState } from "react";
import { geocodeAction, type PlaceHit } from "@/lib/tour-actions";
import { Input } from "@elkdonis/primitives";

interface PlaceSearchProps {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  onPick: (hit: PlaceHit) => void;
  placeholder?: string;
}

/** A text box with Photon suggestions under it; picking one fills the coordinates. */
export function PlaceSearch({ id, value, onChange, onPick, placeholder }: PlaceSearchProps) {
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = useRef("");

  useEffect(() => {
    if (!open) return;
    if (timer.current) clearTimeout(timer.current);
    const q = value.trim();
    if (q.length < 3 || q === last.current) return;
    timer.current = setTimeout(async () => {
      last.current = q;
      setHits(await geocodeAction(q));
    }, 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [value, open]);

  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="mt-1"
        autoComplete="off"
      />
      {open && hits.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto border border-border bg-popover text-sm shadow">
          {hits.map((h) => (
            <li key={`${h.lat},${h.lng}`}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left hover:bg-accent/40"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onPick(h); setOpen(false); setHits([]); }}
              >
                {h.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
