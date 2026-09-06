"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { OrgAgreement, AgreementForMember } from "@elkdonis/services/agreements";
import {
  createAgreementAction,
  publishAgreementAction,
  retireAgreementAction,
  acceptAgreementAction,
  revokeAgreementAction,
} from "@/lib/agreement-actions";

export type AcceptanceRow = {
  agreementId: string;
  userId: string;
  displayName: string | null;
  email: string;
  acceptedAt: string;
  revokedAt: string | null;
};

const input =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40";
const label = "block text-xs font-medium uppercase tracking-wide text-muted-foreground";
const btn =
  "rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-60";

function StatusPill({ status }: { status: OrgAgreement["status"] }) {
  const styles: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    retired: "bg-amber-500/15 text-amber-700 dark:text-amber-500",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}

/**
 * The org-owner side: write terms, publish them, see who has agreed.
 *
 * Publishing is deliberately a separate, confirmed step from drafting. A live
 * agreement is what authorises another party to take a cut of someone's sale,
 * so it should not be one keystroke away from a half-written draft.
 */
export function AgreementsManager({
  orgId,
  orgName,
  agreements,
  acceptances,
}: {
  orgId: string;
  orgName: string;
  agreements: OrgAgreement[];
  acceptances: AcceptanceRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    title: "",
    summary: "",
    bodyHtml: "",
    revenueSharePercent: "0",
    key: "",
  });

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Failed.");
      else router.refresh();
      return res.ok;
    } finally {
      setBusy(false);
    }
  }

  const byKey = new Map<string, OrgAgreement[]>();
  for (const a of agreements) {
    const list = byKey.get(a.key) ?? [];
    list.push(a);
    byKey.set(a.key, list);
  }

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl">Terms {orgName} offers</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            An agreement is the only thing that lets {orgName} take a share of a
            member&rsquo;s sale. Until someone accepts one, they keep 100% of
            anything sold through this organisation &mdash; the sale is still
            recorded as having come through you, but nothing is deducted.
          </p>
        </div>
        <button
          type="button"
          className={`${btn} shrink-0 bg-primary text-primary-foreground hover:bg-primary/90`}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Cancel" : "New agreement"}
        </button>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {open && (
        <div className="space-y-4 rounded-lg border border-border p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className={label} htmlFor="ag-title">Title</label>
              <input
                id="ag-title"
                className={input}
                value={form.title}
                placeholder="Gallery representation"
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className={label} htmlFor="ag-share">
                {orgName}&rsquo;s share (%)
              </label>
              <input
                id="ag-share"
                className={input}
                type="number"
                min={0}
                max={100}
                value={form.revenueSharePercent}
                onChange={(e) =>
                  setForm({ ...form, revenueSharePercent: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                0 means this agreement takes nothing &mdash; useful for terms
                that are about conduct rather than money.
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <label className={label} htmlFor="ag-summary">One-line summary</label>
            <input
              id="ag-summary"
              className={input}
              value={form.summary}
              placeholder="The gallery takes 30% of works sold through its front."
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <label className={label} htmlFor="ag-body">Full terms</label>
            <textarea
              id="ag-body"
              className={`${input} min-h-[160px]`}
              value={form.bodyHtml}
              placeholder="What the member is agreeing to."
              onChange={(e) => setForm({ ...form, bodyHtml: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <label className={label} htmlFor="ag-key">
              Replaces (optional)
            </label>
            <select
              id="ag-key"
              className={input}
              value={form.key}
              onChange={(e) => setForm({ ...form, key: e.target.value })}
            >
              <option value="">Start a new agreement</option>
              {[...byKey.keys()].map((k) => (
                <option key={k} value={k}>
                  New version of &ldquo;{byKey.get(k)![0]!.title}&rdquo;
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              A new version does not change anything for people who already
              accepted the old one. They stay on the terms they agreed to until
              they accept these.
            </p>
          </div>

          <button
            type="button"
            disabled={busy}
            className={`${btn} bg-primary text-primary-foreground hover:bg-primary/90`}
            onClick={async () => {
              const ok = await run(() =>
                createAgreementAction({
                  orgId,
                  key: form.key || undefined,
                  title: form.title,
                  summary: form.summary,
                  bodyHtml: form.bodyHtml,
                  revenueSharePercent: Number(form.revenueSharePercent),
                })
              );
              if (ok) {
                setOpen(false);
                setForm({ title: "", summary: "", bodyHtml: "", revenueSharePercent: "0", key: "" });
              }
            }}
          >
            Save as draft
          </button>
        </div>
      )}

      {agreements.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No agreements yet. Until one exists and is accepted, members keep
          everything they sell through {orgName}.
        </div>
      ) : (
        <ul className="space-y-4">
          {agreements.map((a) => {
            const signed = acceptances.filter(
              (x) => x.agreementId === a.id && !x.revokedAt
            );
            return (
              <li key={a.id} className="rounded-lg border border-border p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{a.title}</h3>
                      <StatusPill status={a.status} />
                      <span className="text-xs text-muted-foreground">v{a.version}</span>
                    </div>
                    {a.summary && (
                      <p className="mt-1 text-sm text-muted-foreground">{a.summary}</p>
                    )}
                    <p className="mt-2 text-sm">
                      <span className="font-medium">{a.revenueSharePercent}%</span>{" "}
                      <span className="text-muted-foreground">
                        to {orgName} on sales by anyone who has accepted this
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {a.status === "draft" && (
                      <button
                        type="button"
                        disabled={busy}
                        className={`${btn} bg-primary text-primary-foreground hover:bg-primary/90`}
                        onClick={() => run(() => publishAgreementAction(a.id))}
                      >
                        Publish
                      </button>
                    )}
                    {a.status === "active" && (
                      <button
                        type="button"
                        disabled={busy}
                        className={`${btn} border border-border hover:bg-muted`}
                        onClick={() => run(() => retireAgreementAction(a.id))}
                      >
                        Stop offering
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 border-t border-border pt-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Accepted by {signed.length}
                  </p>
                  {signed.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {signed.map((s) => (
                        <li
                          key={s.userId}
                          className="rounded-full bg-muted px-2.5 py-1 text-xs"
                          title={new Date(s.acceptedAt).toLocaleString()}
                        >
                          {s.displayName ?? s.email}
                        </li>
                      ))}
                    </ul>
                  )}
                  {a.status === "retired" && signed.length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Retiring stopped new acceptances. These {signed.length} are
                      still on these terms until they accept a newer version or
                      withdraw &mdash; you cannot change what they agreed to.
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * The member side: what this org is asking me to agree to, and where I stand.
 */
export function MemberAgreements({
  orgName,
  agreements,
}: {
  orgName: string;
  agreements: AgreementForMember[];
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Failed.");
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (agreements.length === 0) return null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-serif text-2xl">What {orgName} asks of you</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Accepting is what lets {orgName} take the share below when something of
          yours sells through them. Nothing is deducted until you accept, and you
          can withdraw at any time &mdash; that stops future splits, and leaves
          past sales recorded under the terms that applied then.
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <ul className="space-y-3">
        {agreements.map((a) => (
          <li
            key={a.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-4"
          >
            <div className="min-w-0">
              <p className="font-medium">
                {a.title}{" "}
                <span className="text-xs text-muted-foreground">v{a.version}</span>
              </p>
              {a.summary && (
                <p className="mt-1 text-sm text-muted-foreground">{a.summary}</p>
              )}
              <p className="mt-1 text-sm">
                <span className="font-medium">{a.revenueSharePercent}%</span>{" "}
                <span className="text-muted-foreground">to {orgName}</span>
              </p>
            </div>
            {a.isAccepted ? (
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs text-emerald-700 dark:text-emerald-400">
                  Accepted{" "}
                  {a.acceptedAt ? new Date(a.acceptedAt).toLocaleDateString() : ""}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  className={`${btn} border border-border hover:bg-muted`}
                  onClick={() => run(() => revokeAgreementAction(a.id))}
                >
                  Withdraw
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={busy}
                className={`${btn} shrink-0 bg-primary text-primary-foreground hover:bg-primary/90`}
                onClick={() => run(() => acceptAgreementAction(a.id))}
              >
                Accept
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
