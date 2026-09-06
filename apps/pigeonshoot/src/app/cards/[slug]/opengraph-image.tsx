/**
 * Link preview for a card.
 *
 * Every card getting a proper preview in Messages, Slack, Discord and the rest
 * is the whole growth mechanism for a "look what I found" project, so this is
 * worth its own route. It redirects to the shared renderer rather than
 * duplicating the layout.
 */

import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const alt = "A Pigeonshoot trading card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage({
  params,
}: {
  params: { slug: string };
}) {
  redirect(`/api/cards/${encodeURIComponent(params.slug)}/card.png?og=1`);
}
