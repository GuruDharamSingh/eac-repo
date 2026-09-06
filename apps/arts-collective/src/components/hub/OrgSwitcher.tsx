"use client";

import { useRouter } from "next/navigation";

export type OrgSwitcherOption = {
  slug: string;
  name: string;
  role: string;
};

/**
 * Picks which of the viewer's orgs the Organization tab shows. State lives in
 * the URL (`?org=<slug>`) so the choice survives a refresh and can be linked
 * to; the server page reads it and does the rest.
 */
export function OrgSwitcher({
  options,
  current,
}: {
  options: OrgSwitcherOption[];
  current: string;
}) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="uppercase tracking-wider">Showing</span>
      <select
        value={current}
        onChange={(e) => router.push(`/hub/organization?org=${encodeURIComponent(e.target.value)}`)}
        className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
        aria-label="Choose organization"
      >
        {options.map((o) => (
          <option key={o.slug} value={o.slug}>
            {o.name} · {o.role}
          </option>
        ))}
      </select>
    </label>
  );
}
