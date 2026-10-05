"use client";

import { useState, useTransition } from "react";
import { checkNewPageAction } from "@/lib/puck/actions";

const STARTS = [
  { value: "plain", label: "Plain page" },
  { value: "featured", label: "Featured page" },
  { value: "auction", label: "Silent auction page" },
];

/** Name a page, check the name is free, open the editor on it. */
export function NewPageForm() {
  const [name, setName] = useState("");
  const [from, setFrom] = useState("plain");
  const [error, setError] = useState<string | null>(null);
  const [pending, go] = useTransition();
  return (
    <form
      className="mt-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        go(async () => {
          const res = await checkNewPageAction(name);
          // `in`, not `res.ok`: this app is not strict, and a discriminated
          // union does not narrow on a boolean without it.
          if ("error" in res) setError(res.error);
          else window.location.href = `/edit/${res.slug}?template=${from}`;
        });
      }}
    >
      <label htmlFor="new-page-name" className="block text-sm font-medium">
        New page
      </label>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">/</span>
        <input
          id="new-page-name"
          value={name}
          onChange={(e) => setName(e.target.value.toLowerCase())}
          placeholder="auction"
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          required
          className="w-56 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <select
          aria-label="Start from"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {STARTS.map((s) => (
            <option key={s.value} value={s.value}>
              Start from: {s.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:border-primary disabled:opacity-60"
        >
          {pending ? "Checking…" : "Create and open editor"}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </form>
  );
}
