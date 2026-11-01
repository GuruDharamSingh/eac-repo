"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AuctionSeries } from "@elkdonis/commerce/queries";
import type { SeriesOrg } from "@elkdonis/commerce/server";
import { searchOrgsAction, addOrgAction, removeOrgAction } from "../actions";

const STATUS: Record<SeriesOrg["status"], { label: string; tone: string }> = {
  presenter: { label: "Presents the series", tone: "is-accent" },
  host: { label: "Hosts the series", tone: "is-accent" },
  accepted: { label: "Taking part", tone: "is-ok" },
  invited: { label: "Invited, awaiting answer", tone: "is-warn" },
  declined: { label: "Declined", tone: "is-bad" },
};

export function OrgsPanel({ series, orgs }: { series: AuctionSeries; orgs: SeriesOrg[] }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<Array<{ id: string; name: string; slug: string | null }>>([]);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const taken = new Set(orgs.map((o) => o.orgId));

  React.useEffect(() => {
    if (!open) return;
    let live = true;
    const t = setTimeout(() => searchOrgsAction(series.slug, q).then((r) => live && setHits(r)).catch(() => live && setHits([])), 150);
    return () => { live = false; clearTimeout(t); };
  }, [q, open, series.slug]);

  async function add(org: { id: string; name: string }) {
    setBusy(true);
    const r = await addOrgAction(series.id, series.slug, org.id, series.title);
    setBusy(false);
    setOpen(false);
    setQ("");
    if (!r.ok) return toast.error(r.error ?? "Could not add the organisation.");
    toast.success(r.status === "accepted" ? `${org.name} is taking part.` : `${org.name}'s owners have been asked${r.notified ? ` (${r.notified} emailed)` : ""}.`);
    router.refresh();
  }
  async function remove(org: SeriesOrg) {
    if (!window.confirm(`Remove ${org.name} from the series?`)) return;
    setBusy(true);
    const r = await removeOrgAction(series.id, series.slug, org.orgId);
    setBusy(false);
    if (!r.ok) return toast.error(r.error ?? "Could not remove it.");
    router.refresh();
  }

  return (
    <>
      <section className="sw-card">
        <div className="sw-field sw-search" style={{ maxWidth: 520 }}>
          <label htmlFor="org-search" className="sw-label">Add an organisation</label>
          <input id="org-search" className="sw-input" value={q} placeholder="Search organisations on the network" autoComplete="off"
            onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} />
          {open && (
            <ul className="sw-suggest" style={{ top: "100%" }}>
              {hits.filter((h) => !taken.has(h.id)).map((h) => (
                <li key={h.id}>
                  <button type="button" disabled={busy} onMouseDown={(e) => e.preventDefault()} onClick={() => add(h)}>
                    <span><strong>{h.name}</strong> <span className="sw-muted">{h.slug ? `· ${h.slug}` : ""}</span></span>
                  </button>
                </li>
              ))}
              {hits.filter((h) => !taken.has(h.id)).length === 0 && <li className="sw-muted" style={{ padding: 8 }}>No organisation matches.</li>}
            </ul>
          )}
        </div>
      </section>
      <div className="sw-table-wrap">
        <table className="sw-table">
          <thead><tr><th>Organisation</th><th>Status</th><th>Added</th><th /></tr></thead>
          <tbody>
            {orgs.map((o) => {
              const st = STATUS[o.status];
              return (
                <tr key={o.orgId}>
                  <td><strong>{o.name}</strong>{o.slug && <div className="sw-muted">{o.slug}</div>}</td>
                  <td><span className={`sw-pill ${st.tone}`}>{st.label}</span></td>
                  <td className="sw-muted">
                    {o.invitedAt ? `${new Date(o.invitedAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}${o.invitedByName ? ` by ${o.invitedByName}` : ""}` : "—"}
                    {o.conversationId && <> · <a href={`/messages/${o.conversationId}`}>Conversation</a></>}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {o.status !== "presenter" && o.status !== "host" && (
                      <button type="button" className="sw-link is-danger" disabled={busy} onClick={() => remove(o)}>Remove</button>
                    )}
                  </td>
                </tr>
              );
            })}
            {orgs.length === 0 && <tr><td colSpan={4} className="sw-muted">No organisations yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
