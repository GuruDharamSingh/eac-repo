"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { EmailConnectors } from "@elkdonis/cms-ui/email";

/**
 * The email suite's connectors, over one org's routes.
 *
 * Lifted into a hook because the suite has two hosts — the full page at
 * /hub/email and the popup opened from the org tab's face — and they must
 * write through the same routes. Two copies of this is exactly how the four
 * attempts this suite replaces drifted apart in the first place.
 *
 * Every write is followed by `router.refresh()`, so the server component
 * re-runs its loader and the panel redraws from the database rather than from
 * optimistic local state: an inbox that disagrees with the server about what
 * is unread is worse than one that takes a moment.
 */
export function useEmailConnectors(orgSlug: string): EmailConnectors {
  const router = useRouter();
  const base = `/api/org/${encodeURIComponent(orgSlug)}/email`;

  return React.useMemo<EmailConnectors>(() => {
    /** One fetch shape, so an error reads the same wherever it came from. */
    async function send(
      path: string,
      init: RequestInit
    ): Promise<{ ok: boolean; error?: string } & Record<string, unknown>> {
      try {
        const res = await fetch(`${base}${path}`, {
          headers: { "Content-Type": "application/json" },
          ...init,
        });
        const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) {
          return { ok: false, error: (body.error as string) ?? `Failed (${res.status})` };
        }
        return { ok: true, ...body };
      } catch {
        return { ok: false, error: "Couldn't reach the server." };
      }
    }

    return {
      refresh: () => router.refresh(),

      setMessageState: (id, state) =>
        send(`/messages/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify({ state }),
        }),

      reclassify: (id, classification) =>
        send(`/messages/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify({ classification }),
        }),

      addAddresses: (input) =>
        send("/addresses", { method: "POST", body: JSON.stringify(input) }),

      updateAddress: (input) =>
        send("/addresses", { method: "PATCH", body: JSON.stringify(input) }),

      suppressAddress: (email) =>
        send("/addresses", {
          method: "PATCH",
          body: JSON.stringify({ suppressEmail: email }),
        }),

      removeAddress: (id) =>
        send(`/addresses?id=${encodeURIComponent(id)}`, { method: "DELETE" }),

      saveIdentity: (input) =>
        send("/identity", { method: "PATCH", body: JSON.stringify(input) }),

      saveTemplate: (key, bodyText, bodyHtml) =>
        send(`/template/${encodeURIComponent(key)}`, {
          method: "PUT",
          body: JSON.stringify({ bodyText, bodyHtml: bodyHtml ?? "" }),
        }),

      // Not routed through `send`: this one wants the HTML or an explanation,
      // not an { ok } envelope.
      // One sentence of a letter, not the section appended to it. Same route,
      // different keys in the body — the store merges per block, so saving one
      // never disturbs another.
      saveCopy: (key, slotId, text, html) =>
        send(`/template/${encodeURIComponent(key)}`, {
          method: "PUT",
          body: JSON.stringify({
            copySlot: slotId,
            copyText: text,
            copyHtml: html ?? "",
          }),
        }),

      previewTemplate: async (key) => {
        try {
          const res = await fetch(`${base}/preview/${encodeURIComponent(key)}`, {
            cache: "no-store",
          });
          const body = (await res.json().catch(() => ({}))) as {
            html?: string;
            error?: string;
          };
          if (!res.ok || !body.html) {
            return { error: body.error ?? "Couldn't render that letter." };
          }
          return { html: body.html };
        } catch {
          return { error: "Couldn't reach the server." };
        }
      },
    };
  }, [base, router]);
}
