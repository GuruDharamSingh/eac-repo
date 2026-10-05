"use client";

import { FieldLabel } from "@puckeditor/core";
import { useEffect, useState } from "react";

/**
 * Choose one of the site's services by name. Stores its address (slug), never
 * a copy: the block reads the service at every render, so a repriced or
 * retitled service is right everywhere. "The visitor's choice" stores nothing,
 * which lets a list card's `?service=` pick what the page shows.
 */
export function ServicePickerField({
  value,
  onChange,
  readOnly,
  field,
}: {
  value?: unknown;
  onChange: (v: string) => void;
  readOnly?: boolean;
  field?: { label?: string };
}) {
  const [options, setOptions] = useState<Array<{ slug: string; title: string }> | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/blocks/pt-services?limit=24")
      .then((r) => (r.ok ? r.json() : { services: [] }))
      .then((b: { services?: Array<{ slug: string; title: string }> }) => live && setOptions(b.services ?? []))
      .catch(() => live && setOptions([]));
    return () => {
      live = false;
    };
  }, []);

  const current = typeof value === "string" ? value : "";
  return (
    <FieldLabel label={field?.label ?? "Service"} el="div">
      <select
        value={current}
        disabled={readOnly || options === null}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", padding: "5px 6px", font: "inherit" }}
      >
        <option value="">The visitor&rsquo;s choice, else the newest</option>
        {(options ?? []).map((o) => (
          <option key={o.slug} value={o.slug}>
            {o.title}
          </option>
        ))}
        {current && options && !options.some((o) => o.slug === current) ? (
          <option value={current}>{current} (not found)</option>
        ) : null}
      </select>
    </FieldLabel>
  );
}
