"use server";

import { revalidatePath } from "next/cache";
import {
  sendMessage,
  markConversationRead,
  getOrCreateDirectConversation,
} from "@elkdonis/messaging/server";
import { getArtworkById } from "@elkdonis/commerce/queries";
import { getCurrentUserId } from "@/lib/marketplace-auth";

/** Post a message into a conversation the signed-in user belongs to. */
export async function sendMessageAction(input: {
  conversationId: string;
  body: string;
}): Promise<{ ok: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Please sign in." };
  if (!input.body.trim()) return { ok: false, error: "Message is empty." };
  try {
    await sendMessage({
      conversationId: input.conversationId,
      senderId: userId,
      body: input.body,
    });
    revalidatePath(`/messages/${input.conversationId}`);
    revalidatePath("/messages");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed." };
  }
}

/** Mark a conversation read for the signed-in user. */
export async function markReadAction(conversationId: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  await markConversationRead({ conversationId, userId });
  revalidatePath("/messages");
}

/**
 * Start (or reuse) a direct conversation with the artist of an artwork, about
 * that artwork, and post the buyer's first message. Returns the conversation id
 * so the caller can navigate to it.
 */
export async function messageArtistAction(input: {
  artworkId: string;
  body: string;
}): Promise<{ ok: boolean; conversationId?: string; needsAuth?: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, needsAuth: true };

  const artwork = await getArtworkById(input.artworkId);
  if (!artwork) return { ok: false, error: "Artwork not found." };
  if (artwork.artistUserId === userId) {
    return { ok: false, error: "That's your own piece." };
  }
  if (!input.body.trim()) return { ok: false, error: "Message is empty." };

  try {
    const { conversationId } = await getOrCreateDirectConversation({
      userA: userId,
      userB: artwork.artistUserId,
      context: { type: "artwork", id: artwork.id },
      subject: artwork.title,
    });
    await sendMessage({ conversationId, senderId: userId, body: input.body });
    revalidatePath("/messages");
    return { ok: true, conversationId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed." };
  }
}
