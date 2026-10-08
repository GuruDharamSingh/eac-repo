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
    <div className="ad-place">
      <label className="ad-label" htmlFor="place-search">
        Location {value.city || value.region ? "" : <span className="ad-field-aside">— start typing a city, neighbourhood, region, or postal code</span>}
      </label>

      {!manual && (
        <>
          <input
            id="place-search"
            className="ad-field"
            value={query}
            autoComplete="off"
            placeholder="e.g. Annex, Toronto, Ontario, M5R…"
            onChange={(e) => { setQuery(e.currentTarget.value); pickedRef.current = false; }}
            onFocus={() => suggestions.length && setOpen(true)}
          />
          {open && (suggestions.length > 0 || loading) && (
            <ul className="ad-place-list">
              {loading && <li className="ad-place-status">Searching…</li>}
              {suggestions.map((s, i) => (
                <li key={`${s.label}-${i}`}>
                  <button type="button" onClick={() => pick(s)} className="ad-place-option">
                    <strong>{s.name}</strong>
                    <span className="ad-place-detail">
                      {" "}· {[s.region, s.country].filter(Boolean).join(", ")} {s.type ? `· ${s.type}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {(value.city || value.region) && (
            <p className="ad-place-picked">
              📍 {[value.city, value.region, value.country].filter(Boolean).join(", ")}
              {value.postcode ? ` · ${value.postcode}` : ""}
              {value.lat != null ? " · mapped" : ""}
            </p>
          )}
          <button type="button" onClick={() => setManual(true)} className="ad-link-button">
            Can’t find it? Enter manually →
          </button>
        </>
      )}

      {manual && (
        <>
          <div className="ad-field-row" data-cols="3">
            <input className="ad-field" placeholder="City" value={value.city} onChange={(e) => editField("city", e.currentTarget.value)} />
            <input className="ad-field" placeholder="Region / state" value={value.region} onChange={(e) => editField("region", e.currentTarget.value)} />
            <input className="ad-field" placeholder="Country" value={value.country} onChange={(e) => editField("country", e.currentTarget.value)} />
          </div>
          <button type="button" onClick={() => setManual(false)} className="ad-link-button">
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
