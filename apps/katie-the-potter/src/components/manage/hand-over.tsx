"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClaimLinkAction, revokeClaimLinksAction } from "@/lib/claim-actions";
import { useToast } from "@elkdonis/cms-ui/manage/client";

/**
 * "Hand the shop to its owner": creates the one-time claim link and shows it
 * ONCE (only its hash is stored), with a copy button. Creating a new link
 * revokes the earlier unused one.
 */
export function HandOver({ hasActive }: { hasActive: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const create = () =>
    start(async () => {
      if (hasActive && !window.confirm("A link is already open. A new one replaces it, and the old one stops working. Continue?")) return;
      const r = await createClaimLinkAction().catch(() => null);
      toast(r);
      if (r?.ok) {
        setLink({ url: r.url, expiresAt: r.expiresAt });
        setCopied(false);
        router.refresh();
      }
    });

  const revoke = () =>
    start(async () => {
      if (!window.confirm("Stop the open link from working?")) return;
      const r = await revokeClaimLinksAction().catch(() => null);
      toast(r);
      setLink(null);
      router.refresh();
    });

  return (
    <div className="ktp-m-handover">
      {link ? (
        <div className="ktp-m-linkbox">
          <label className="ktp-m-field">
            <span>The link (shown once)</span>
            <input className="ktp-input ktp-m-mono" readOnly value={link.url} onFocus={(e) => e.currentTarget.select()} />
          </label>
          <p className="ktp-m-actions">
            <button
              type="button"
              className="ktp-btn"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link.url);
                  setCopied(true);
                } catch {
                  toast({ ok: false, message: "Copy didn't work here; select the link and copy it by hand." });
                }
              }}
            >
              {copied ? "Copied" : "Copy link"}
            </button>
            <span className="ktp-m-fine">Works once, until {new Date(link.expiresAt).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}.</span>
          </p>
        </div>
      ) : null}
      <p className="ktp-m-actions">
        <button type="button" className={link ? "ktp-btn ktp-btn--ghost" : "ktp-btn"} disabled={pending} onClick={create}>
          {pending ? "Working…" : hasActive || link ? "Create a new link" : "Create a hand-over link"}
        </button>
        {hasActive || link ? (
          <button type="button" className="ktp-m-linkbtn" disabled={pending} onClick={revoke}>
            Stop the open link
          </button>
        ) : null}
      </p>
    </div>
  );
}
