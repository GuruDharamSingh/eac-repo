"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { EmailConnectors } from "@elkdonis/cms-ui/email";

/**
 * The email suite's connectors, over this site's routes.
 *
 * Single-tenant, so there is no org in any path — the routes read
 * `siteConfig.orgId` server-side. That is the whole reason this app is where
 * the suite is fully integrated: every per-letter editor and the newsletter
 * are org-IMPLIED routes here, and none of them needs a slug threaded through.
 *
 * A hook rather than an object because the suite has two hosts — the full page
 * at /hub/email and the popup opened from the hub's face — and they must write
 * through the same routes. Two copies of this is how the attempts this suite
 * replaces drifted apart in the first place.
 *
 * Every write is followed by `router.refresh()`, so the server component
 * re-runs its loader and the panel redraws from the database rather than from
 * optimistic local state: an inbox that disagrees with the server about what
 * is unread is worse than one that takes a moment.
 */
export function useEmailConnectors(): EmailConnectors {
  const router = useRouter();

  return React.useMemo<EmailConnectors>(() => {
    const base = "/api/hub/email";

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

      // This app already had these two routes — they are what the retired
      // /hub/email/<key> page posted to. The suite reuses them rather than
      // adding a third way to save the same field.
      saveTemplate: (key, bodyText) =>
        send(`/${encodeURIComponent(key)}`, {
          method: "PUT",
          body: JSON.stringify({ bodyText }),
        }),

      testTemplate: (key) =>
        send(`/${encodeURIComponent(key)}/test`, { method: "POST" }),

      // Not routed through `send`: this one wants the HTML or an explanation,
      // not an { ok } envelope.
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
  }, [router]);
}
