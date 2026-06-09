"use client";

import { useEffect, useRef, useState } from "react";

export type PlaceValue = {
  label: string;
  city: string;
  region: string;
  country: string;
  postcode: string;
  lat: number | null;
  lng: number | null;
};

type Suggestion = PlaceValue & { name: string; type: string };

const input: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.6rem",
  border: "1px solid #1a1a1a",
  background: "#fff",
  fontFamily: "inherit",
  fontSize: 14,
  boxSizing: "border-box",
};
const label: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  letterSpacing: 1,
  textTransform: "uppercase",
  fontWeight: 700,
  margin: "1rem 0 0.25rem",
};

export function PlaceAutocomplete({ initial }: { initial?: Partial<PlaceValue> }) {
  const [value, setValue] = useState<PlaceValue>({
    label: initial?.label ?? "",
    city: initial?.city ?? "",
    region: initial?.region ?? "",
    country: initial?.country ?? "",
    postcode: initial?.postcode ?? "",
    lat: initial?.lat ?? null,
    lng: initial?.lng ?? null,
  });
  const initialQuery = initial?.label || [initial?.city, initial?.region].filter(Boolean).join(", ");
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [manual, setManual] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const pickedRef = useRef(Boolean(initial?.city || initial?.region));

  useEffect(() => {
    const q = query.trim();
    if (manual || q.length < 2 || pickedRef.current) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const res = await fetch(`/api/geo/suggest?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = await res.json();
        setSuggestions(data.places ?? []);
        setOpen(true);
      } catch {
        /* aborted or failed — keep manual fallback available */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, manual]);

  function pick(s: Suggestion) {
    setValue({ label: s.label, city: s.city || s.name, region: s.region, country: s.country, postcode: s.postcode, lat: s.lat, lng: s.lng });
    setQuery(s.label);
    pickedRef.current = true;
    setOpen(false);
    setSuggestions([]);
  }

  function editField(key: keyof PlaceValue, v: string) {
    setValue((prev) => ({ ...prev, [key]: v }));
  }

  return (
    <div style={{ position: "relative" }}>
      <label style={label} htmlFor="place-search">
        Location {value.city || value.region ? "" : <span style={{ fontWeight: 400, textTransform: "none", color: "#8a8070" }}>— start typing a city, neighbourhood, region, or postal code</span>}
      </label>

      {!manual && (
        <>
          <input
            id="place-search"
            style={input}
            value={query}
            autoComplete="off"
            placeholder="e.g. Annex, Toronto, Ontario, M5R…"
            onChange={(e) => { setQuery(e.currentTarget.value); pickedRef.current = false; }}
            onFocus={() => suggestions.length && setOpen(true)}
          />
          {open && (suggestions.length > 0 || loading) && (
            <ul
              style={{
                position: "absolute", zIndex: 5, left: 0, right: 0, margin: "2px 0 0", padding: 0, listStyle: "none",
                background: "#fff", border: "1px solid #1a1a1a", maxHeight: 240, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,.25)",
              }}
            >
              {loading && <li style={{ padding: "0.5rem 0.6rem", fontSize: 13, color: "#8a8070" }}>Searching…</li>}
              {suggestions.map((s, i) => (
                <li key={`${s.label}-${i}`}>
                  <button
                    type="button"
                    onClick={() => pick(s)}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "0.5rem 0.6rem", border: "none", borderBottom: "1px solid #eee", background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 14 }}
                  >
                    <strong>{s.name}</strong>
                    <span style={{ color: "#8a8070", fontSize: 12 }}>
                      {" "}· {[s.region, s.country].filter(Boolean).join(", ")} {s.type ? `· ${s.type}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {(value.city || value.region) && (
            <p style={{ fontSize: 12, color: "#1a5c2a", margin: "0.35rem 0 0" }}>
              📍 {[value.city, value.region, value.country].filter(Boolean).join(", ")}
              {value.postcode ? ` · ${value.postcode}` : ""}
              {value.lat != null ? " · mapped" : ""}
            </p>
          )}
          <button type="button" onClick={() => setManual(true)} style={{ background: "none", border: "none", color: "#8c3b3b", fontSize: 11, cursor: "pointer", padding: "0.25rem 0", fontFamily: "inherit" }}>
            Can’t find it? Enter manually →
          </button>
        </>
      )}

      {manual && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.6rem" }}>
            <input style={input} placeholder="City" value={value.city} onChange={(e) => editField("city", e.currentTarget.value)} />
            <input style={input} placeholder="Region / state" value={value.region} onChange={(e) => editField("region", e.currentTarget.value)} />
            <input style={input} placeholder="Country" value={value.country} onChange={(e) => editField("country", e.currentTarget.value)} />
          </div>
          <button type="button" onClick={() => setManual(false)} style={{ background: "none", border: "none", color: "#8c3b3b", fontSize: 11, cursor: "pointer", padding: "0.25rem 0", fontFamily: "inherit" }}>
            ← Back to place search
          </button>
        </>
      )}

      {/* Structured values submitted with the form */}
      <input type="hidden" name="city" value={value.city} />
      <input type="hidden" name="region" value={value.region} />
      <input type="hidden" name="country" value={value.country} />
      <input type="hidden" name="postal_code" value={value.postcode} />
      <input type="hidden" name="lat" value={value.lat ?? ""} />
      <input type="hidden" name="lng" value={value.lng ?? ""} />
    </div>
  );
}
