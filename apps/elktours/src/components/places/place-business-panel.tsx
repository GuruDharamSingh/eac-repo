"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { BusinessListing, BusinessWebsiteStatus } from "@elkdonis/services/businesses";
import type { PlaceBusinessSummary } from "@/lib/catalogue-types";
import {
  createBusinessFromPlaceAction,
  getBusinessAction,
  linkPlaceBusinessAction,
  listStewardBusinessesAction,
  unlinkPlaceBusinessAction,
  updateBusinessFactsAction,
} from "@/lib/business-actions";
import { BusinessCard } from "@/components/places/business-card";

function errText(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

type R = { ok: true } | { ok: false; error: string };
const fail = (fallback: string) => (e: unknown): R => ({ ok: false, error: errText(e, fallback) });

const btn = "text-xs underline underline-offset-4 disabled:opacity-40";
const field = "w-full rounded-md border border-border bg-background px-2 py-1 text-sm";

/**
 * /manage/places: the businesses at a place (network listings, place_businesses).
 * Link an existing listing or create a shell from the place (prefilled from its
 * gathered facts), make one primary, unlink (kept as a former operator), and
 * edit a shell's facts. Writes need an elktours owner (lib/business-actions.ts);
 * guides see the panel and get the action's refusal.
 */
export function PlaceBusinessPanel({ placeId, placeTitle, businesses }: { placeId: string; placeTitle: string; businesses: PlaceBusinessSummary[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [linking, setLinking] = React.useState(false);

  async function run(key: string, done: string, fn: () => Promise<R>) {
    setBusy(key);
    const r = await fn();
    setBusy(null);
    if (r.ok === false) return void toast.error(r.error);
    toast.success(done);
    router.refresh();
  }

  async function createShell() {
    const name = window.prompt("Name of the business (as it trades):", placeTitle);
    if (name === null) return;
    setBusy("create");
    const r = await createBusinessFromPlaceAction(placeId, { name: name.trim() || placeTitle }).catch(fail("Could not create the listing."));
    setBusy(null);
    if (r.ok === false) return void toast.error(r.error);
    toast.success("created" in r && r.created ? "Listing created (unclaimed) and linked" : "An existing listing matched; it is now linked");
    router.refresh();
  }

  return (
    <section className="space-y-3" aria-label="Businesses at this place">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-medium">Business at this place</h4>
        <span className="flex gap-3">
          <button type="button" disabled={busy !== null} onClick={createShell} className={btn}>
            {busy === "create" ? "Creating…" : "Create a business listing from this place"}
          </button>
          <button type="button" disabled={busy !== null} onClick={() => setLinking((v) => !v)} className={btn} aria-expanded={linking}>
            Link an existing listing
          </button>
        </span>
      </div>

      {linking && (
        <LinkExisting
          already={new Set(businesses.map((b) => b.userId))}
          onLink={(userId, relation, isPrimary) =>
            run("link", "Linked", () => linkPlaceBusinessAction(placeId, userId, { relation, isPrimary }).catch(fail("Could not link."))).then(() => setLinking(false))
          }
        />
      )}

      {businesses.length === 0 ? (
        <p className="text-sm text-muted-foreground">None linked. A shop, café or museum here can get an unclaimed listing that its owner may later claim.</p>
      ) : (
        <ul className="space-y-3">
          {businesses.map((b) => (
            <li key={b.userId} className="space-y-1.5">
              <BusinessCard business={b} compact />
              <div className="flex flex-wrap gap-3">
                {b.isPrimary ? (
                  <span className="text-xs text-muted-foreground">Primary</span>
                ) : (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => run(`p-${b.userId}`, "Now the primary business", () => linkPlaceBusinessAction(placeId, b.userId, { relation: b.relation, isPrimary: true }).catch(fail("Failed")))}
                    className={btn}
                  >
                    Make primary
                  </button>
                )}
                {b.status === "shell" && (
                  <button type="button" disabled={busy !== null} onClick={() => setEditing(editing === b.userId ? null : b.userId)} className={btn} aria-expanded={editing === b.userId}>
                    Edit facts
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => {
                    if (!window.confirm(`Unlink ${b.name}? It stays on record as a former business here.`)) return;
                    void run(`u-${b.userId}`, "Unlinked (kept as former)", () => unlinkPlaceBusinessAction(placeId, b.userId, true).catch(fail("Failed")));
                  }}
                  className={`${btn} text-muted-foreground`}
                >
                  Unlink
                </button>
              </div>
              {editing === b.userId && <FactsForm userId={b.userId} onSaved={() => { setEditing(null); router.refresh(); }} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LinkExisting({ already, onLink }: { already: Set<string>; onLink: (userId: string, relation: "operates" | "hosts", isPrimary: boolean) => void }) {
  const [list, setList] = React.useState<BusinessListing[] | null>(null);
  const [q, setQ] = React.useState("");
  const [relation, setRelation] = React.useState<"operates" | "hosts">("operates");
  const [primary, setPrimary] = React.useState(true);
  React.useEffect(() => {
    void listStewardBusinessesAction().then(setList).catch(() => setList([]));
  }, []);
  if (!list) return <p className="text-xs text-muted-foreground">Loading listings…</p>;
  const needle = q.trim().toLowerCase();
  const shown = list.filter((b) => b.status !== "removed" && !already.has(b.userId) && (!needle || b.name.toLowerCase().includes(needle))).slice(0, 25);
  return (
    <div className="space-y-2 rounded-md border border-dashed border-border p-3">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the listings" className={field} />
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={relation === "operates"} onChange={() => setRelation("operates")} /> Operates the place
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={relation === "hosts"} onChange={() => setRelation("hosts")} /> Inside it
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={primary} onChange={(e) => setPrimary(e.target.checked)} /> Primary
        </label>
      </div>
      {shown.length === 0 ? (
        <p className="text-xs text-muted-foreground">No other listings{needle ? " match" : ""}. Create one from the place instead.</p>
      ) : (
        <ul className="max-h-48 divide-y divide-border overflow-auto text-sm">
          {shown.map((b) => (
            <li key={b.userId} className="flex items-center justify-between gap-2 py-1.5">
              <span className="min-w-0 truncate">
                {b.name}
                <span className="ml-2 text-xs text-muted-foreground">{[b.categoryLabel ?? b.category, b.status === "shell" ? "unclaimed" : b.status].filter(Boolean).join(" · ")}</span>
              </span>
              <button type="button" onClick={() => onLink(b.userId, relation, primary)} className={btn}>
                Link
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A shell's facts (steward only). Name and facts, never a bio, logo, prices or offers (rule 1). */
function FactsForm({ userId, onSaved }: { userId: string; onSaved: () => void }) {
  const [b, setB] = React.useState<BusinessListing | null>(null);
  const [f, setF] = React.useState<Record<string, string>>({});
  const [websiteStatus, setWebsiteStatus] = React.useState<BusinessWebsiteStatus>("none");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    void getBusinessAction(userId).then((r) => {
      if (!r) return;
      const x = r.business;
      setB(x);
      setWebsiteStatus(x.websiteStatus);
      setF({
        name: x.name,
        category: x.category ?? "",
        streetAddress: x.streetAddress ?? "",
        postalCode: x.postalCode ?? "",
        city: x.city ?? "",
        website: x.website ?? x.websiteCandidate ?? "",
        phone: x.phone ?? "",
        openingHours: x.openingHours ?? "",
      });
    });
  }, [userId]);
  if (!b) return <p className="text-xs text-muted-foreground">Loading…</p>;
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF((m) => ({ ...m, [k]: e.target.value }));
  const val = (k: string) => (f[k] ?? "").trim() || null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!val("name")) return void toast.error("A name is needed.");
    setBusy(true);
    const r = await updateBusinessFactsAction(userId, {
      name: val("name")!,
      category: val("category"),
      streetAddress: val("streetAddress"),
      postalCode: val("postalCode"),
      city: val("city"),
      website: val("website"),
      websiteStatus: val("website") ? websiteStatus : "none",
      phone: val("phone"),
      openingHours: val("openingHours"),
    }).catch((x: unknown) => ({ ok: false as const, error: errText(x, "Could not save.") }));
    setBusy(false);
    if (r.ok === false) return void toast.error(r.error);
    toast.success("Facts saved");
    onSaved();
  }

  const row = (k: string, label: string, hint?: string) => (
    <label className="block text-xs">
      <span className="font-medium">{label}</span>
      {hint ? <span className="ml-1 text-muted-foreground">{hint}</span> : null}
      <input value={f[k] ?? ""} onChange={set(k)} className={`${field} mt-0.5`} />
      {b.factsSource[k]?.source ? <span className="text-[0.65rem] text-muted-foreground">from {b.factsSource[k]!.source}{b.factsSource[k]!.ref ? ` (${b.factsSource[k]!.ref})` : ""}</span> : null}
    </label>
  );

  return (
    <form onSubmit={save} className="grid gap-2 rounded-md border border-dashed border-border p-3 sm:grid-cols-2">
      {row("name", "Name")}
      {row("category", "Kind", "(bakery, cafe, museum…)")}
      {row("streetAddress", "Street address")}
      <div className="grid grid-cols-2 gap-2">
        {row("postalCode", "Postcode")}
        {row("city", "City")}
      </div>
      {row("website", "Website")}
      <label className="flex items-center gap-1.5 self-end text-xs">
        <input type="checkbox" checked={websiteStatus === "confirmed"} onChange={(e) => setWebsiteStatus(e.target.checked ? "confirmed" : "pending_review")} />
        Website checked: show it publicly
      </label>
      {row("phone", "Public phone")}
      {row("openingHours", "Opening hours", "(OSM syntax, e.g. Mo-Sa 08:00-19:00)")}
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={busy} className="bg-primary px-3 py-1 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {busy ? "Saving…" : "Save facts"}
        </button>
        <span className="text-[0.7rem] text-muted-foreground">Facts only: no description in the business&apos;s voice, no logo, prices or offers.</span>
      </div>
    </form>
  );
}
