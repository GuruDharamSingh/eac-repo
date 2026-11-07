"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { BusinessClaim, BusinessListing } from "@elkdonis/services/businesses";
import { decideBusinessClaimAction, removeBusinessAction, restoreBusinessAction } from "@/lib/business-actions";

const METHOD: Record<BusinessClaim["method"], string> = {
  domain_email: "Email at the business's own domain",
  phone: "Phone call-back",
  document: "Document",
  in_person: "Met in person",
  steward_vouch: "Vouched by the steward",
};

function day(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

const ARTDIRECT_URL = (process.env.NEXT_PUBLIC_ARTDIRECT_URL ?? "").replace(/\/$/, "");
const btn = "border border-border px-3 py-1 text-sm disabled:opacity-50";

/**
 * /manage/businesses: what this org stewards. Claims waiting (approve or
 * reject; the action says when only a platform admin may decide), removal
 * requests coming due, and every listing with its status. A shell is facts
 * only: nothing here can sell, book, vouch or verify.
 */
export function BusinessesSteward({ listings, claims }: { listings: BusinessListing[]; claims: (BusinessClaim & { canDecide: boolean })[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function run(key: string, done: string, fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setBusy(key);
    const r = await fn().catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Failed" }));
    setBusy(null);
    if (r.ok === false) return void toast.error(r.error);
    toast.success(done);
    router.refresh();
  }

  const pending = claims.filter((c) => c.status === "pending");
  const removals = listings.filter((b) => b.status !== "removed" && b.removalDueAt);

  return (
    <div className="space-y-10">
      <section>
        <h3 className="font-serif text-xl">Claims waiting ({pending.length})</h3>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No one is claiming a listing right now.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border border border-border">
            {pending.map((c) => (
              <li key={c.id} className="space-y-1 p-3 text-sm">
                <p>
                  <strong>{c.claimantName ?? "Someone"}</strong>
                  {c.claimantEmail ? <span className="text-muted-foreground"> ({c.claimantEmail})</span> : null} claims{" "}
                  {c.businessSlug && ARTDIRECT_URL ? (
                    <a href={`${ARTDIRECT_URL}/${c.businessSlug}`} target="_blank" rel="noopener" className="underline underline-offset-4">
                      {c.businessName}
                    </a>
                  ) : (
                    c.businessName
                  )}{" "}
                  · {day(c.createdAt)}
                </p>
                <p className="text-muted-foreground">How: {METHOD[c.method] ?? c.method}</p>
                {c.message && <p className="whitespace-pre-line">“{c.message}”</p>}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {c.canDecide ? (
                    <>
                      <button
                        type="button"
                        disabled={busy === c.id}
                        onClick={() => window.confirm(`Approve? ${c.businessName} becomes their organisation, and other claims on it are declined.`) && void run(c.id, "Claim approved", () => decideBusinessClaimAction(c.id, "approved"))}
                        className={`${btn} bg-primary font-medium text-primary-foreground`}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busy === c.id}
                        onClick={() => {
                          const reason = window.prompt("Why not? (kept with the claim)");
                          if (reason === null) return;
                          void run(c.id, "Claim rejected", () => decideBusinessClaimAction(c.id, "rejected", reason.trim() || undefined));
                        }}
                        className={btn}
                      >
                        Reject
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">A platform admin decides this one (only in-person claims can be approved here).</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="font-serif text-xl">Removal requests ({removals.length})</h3>
        {removals.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No one has asked for a listing to be removed.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border border border-border">
            {removals.map((b) => (
              <li key={b.userId} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span>
                  <strong>{b.name}</strong> · act by {day(b.removalDueAt)}
                </span>
                <button
                  type="button"
                  disabled={busy === b.userId}
                  onClick={() => window.confirm(`Remove ${b.name}? Its page answers "gone" and places stop showing it; a tombstone keeps imports from re-adding it.`) && void run(b.userId, "Removed", () => removeBusinessAction(b.userId, "Removal requested"))}
                  className={btn}
                >
                  Remove now
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="font-serif text-xl">Listings ({listings.length})</h3>
        {listings.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">None yet. Create one from a place in Places.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead className="border-b border-border text-left text-muted-foreground">
              <tr>
                <th className="pb-2 font-medium">Business</th>
                <th className="pb-2 font-medium">Kind</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {listings.map((b) => (
                <tr key={b.userId} className={b.status === "removed" ? "opacity-60" : ""}>
                  <td className="py-2 pr-3">
                    {ARTDIRECT_URL && b.status !== "removed" ? (
                      <a href={`${ARTDIRECT_URL}/${b.slug}`} target="_blank" rel="noopener" className="underline underline-offset-4">
                        {b.name}
                      </a>
                    ) : (
                      b.name
                    )}
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">{b.categoryLabel ?? b.category ?? "—"}</td>
                  <td className="py-2 pr-3">
                    {b.status === "shell" ? "Unclaimed" : b.status === "claimed" ? `Claimed ${day(b.claimedAt)}` : `Removed ${day(b.removedAt)}`}
                    {b.websiteStatus === "pending_review" ? <span className="ml-2 text-xs text-muted-foreground">website to check</span> : null}
                  </td>
                  <td className="py-2 text-right">
                    {b.status === "shell" && (
                      <button
                        type="button"
                        disabled={busy === b.userId}
                        onClick={() => {
                          const reason = window.prompt(`Remove ${b.name}? Reason (kept on the tombstone):`);
                          if (reason === null) return;
                          void run(b.userId, "Removed", () => removeBusinessAction(b.userId, reason.trim() || "Removed by the steward"));
                        }}
                        className="text-xs underline underline-offset-4 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                    {b.status === "removed" && (
                      <button type="button" disabled={busy === b.userId} onClick={() => run(b.userId, "Restored", () => restoreBusinessAction(b.userId))} className="text-xs underline underline-offset-4 disabled:opacity-50">
                        Restore
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
