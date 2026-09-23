"use server";

import { revalidatePath } from "next/cache";
import { createTopic } from "@elkdonis/services";
import { getCurrentUser } from "@/lib/session";
import {
  ELKDONIS_FEEDS,
  ELKDONIS_ORG,
  forumHref,
  forumViewerFor,
  type ElkdonisFeedSlug,
} from "@/lib/elkdonis-hub";

export type PostState = {
  ok: boolean;
  message: string | null;
  /** Link to the topic just made, on the forum. */
  href?: string;
};

const ALLOWED = new Set<string>(Object.values(ELKDONIS_FEEDS));

/**
 * One action for all three of the tab's composers (feedback, announcement,
 * cross-post suggestion). The feed arrives as a form field, so it is checked
 * against the tab's own three — and the real gate is createTopic, which
 * applies the feed's post_role against the viewer's roles (stewardship
 * included). A non-steward submitting to announcements gets that refusal.
 */
export async function postToElkdonis(_prev: PostState, form: FormData): Promise<PostState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in first." };

  const feed = String(form.get("feed") ?? "");
  if (!ALLOWED.has(feed)) return { ok: false, message: "No such category." };

  let text = String(form.get("text") ?? "").trim();
  const link = String(form.get("link") ?? "").trim();
  if (link) {
    if (!/^https?:\/\/\S+$/i.test(link)) return { ok: false, message: "That link needs to start with http:// or https://." };
    text = text ? `${text}\n\n${link}` : link;
  }

  const viewer = await forumViewerFor(user.id);
  const result = await createTopic(viewer, {
    orgId: ELKDONIS_ORG,
    feedSlug: feed as ElkdonisFeedSlug,
    title: String(form.get("title") ?? ""),
    text,
  });
  if (result.ok === false) return { ok: false, message: result.error };

  revalidatePath("/hub/elkdonis");
  return {
    ok: true,
    message: feed === ELKDONIS_FEEDS.announcements ? "Announced." : "Posted — thank you.",
    href: forumHref.thread(result.threadId, result.slug),
  };
}
