/**
 * Write-side operations for the messaging domain. Call from server actions /
 * API routes only.
 */

import { db } from "@elkdonis/db";
import type { ConversationContext } from "./types";

type Row = Record<string, unknown>;

/**
 * Find an existing direct conversation between exactly two users (optionally
 * scoped to the same context), or create one. Returns the conversation id.
 *
 * "Direct" = exactly those two participants. Scoping by context lets, e.g., a
 * buyer↔artist thread about a specific artwork stay separate from a general DM.
 */
export async function getOrCreateDirectConversation(input: {
  userA: string;
  userB: string;
  context?: ConversationContext | null;
  subject?: string | null;
}): Promise<{ conversationId: string; created: boolean }> {
  const { userA, userB, context = null, subject = null } = input;

  const existing = (await db`
    SELECT c.id
    FROM conversation c
    JOIN conversation_participant pa
      ON pa.conversation_id = c.id AND pa.user_id = ${userA}
    JOIN conversation_participant pb
      ON pb.conversation_id = c.id AND pb.user_id = ${userB}
    WHERE (SELECT COUNT(*) FROM conversation_participant p
           WHERE p.conversation_id = c.id) = 2
      AND c.context_type IS NOT DISTINCT FROM ${context?.type ?? null}
      AND c.context_id   IS NOT DISTINCT FROM ${context?.id ?? null}
    LIMIT 1
  `) as unknown as Row[];

  if (existing[0]) {
    return { conversationId: existing[0].id as string, created: false };
  }

  const convo = (await db`
    INSERT INTO conversation (subject, context_type, context_id)
    VALUES (${subject}, ${context?.type ?? null}, ${context?.id ?? null})
    RETURNING id
  `) as unknown as Row[];
  const conversationId = convo[0]!.id as string;

  await db`
    INSERT INTO conversation_participant (conversation_id, user_id)
    VALUES (${conversationId}, ${userA}), (${conversationId}, ${userB})
    ON CONFLICT DO NOTHING
  `;

  return { conversationId, created: true };
}

/**
 * Start a group conversation with an explicit participant list and an optional
 * opening message. Returns the new conversation id.
 */
export async function startConversation(input: {
  participantIds: string[];
  subject?: string | null;
  context?: ConversationContext | null;
  openingMessage?: { senderId: string; body: string } | null;
}): Promise<{ conversationId: string }> {
  const participants = Array.from(new Set(input.participantIds));
  if (participants.length < 2) {
    throw new Error("A conversation needs at least two participants.");
  }

  return db.begin(async (tx) => {
    const convo = (await tx`
      INSERT INTO conversation (subject, context_type, context_id)
      VALUES (${input.subject ?? null}, ${input.context?.type ?? null}, ${input.context?.id ?? null})
      RETURNING id
    `) as unknown as Row[];
    const conversationId = convo[0]!.id as string;

    for (const uid of participants) {
      await tx`
        INSERT INTO conversation_participant (conversation_id, user_id)
        VALUES (${conversationId}, ${uid})
        ON CONFLICT DO NOTHING
      `;
    }

    if (input.openingMessage) {
      await tx`
        INSERT INTO message (conversation_id, sender_id, body)
        VALUES (${conversationId}, ${input.openingMessage.senderId}, ${input.openingMessage.body})
      `;
      await tx`
        UPDATE conversation SET last_message_at = NOW() WHERE id = ${conversationId}
      `;
    }

    return { conversationId };
  });
}

/**
 * Post a message to a conversation. The sender must already be a participant
 * (guards against posting into threads you're not in). Bumps last_message_at
 * and marks the message read for the sender.
 */
export async function sendMessage(input: {
  conversationId: string;
  senderId: string;
  body: string;
}): Promise<{ id: string }> {
  const body = input.body.trim();
  if (!body) throw new Error("Message cannot be empty.");

  return db.begin(async (tx) => {
    const member = (await tx`
      SELECT 1 FROM conversation_participant
      WHERE conversation_id = ${input.conversationId} AND user_id = ${input.senderId}
      LIMIT 1
    `) as unknown as Row[];
    if (!member[0]) throw new Error("You are not part of this conversation.");

    const inserted = (await tx`
      INSERT INTO message (conversation_id, sender_id, body)
      VALUES (${input.conversationId}, ${input.senderId}, ${body})
      RETURNING id
    `) as unknown as Row[];

    await tx`
      UPDATE conversation SET last_message_at = NOW()
      WHERE id = ${input.conversationId}
    `;
    await tx`
      UPDATE conversation_participant SET last_read_at = NOW()
      WHERE conversation_id = ${input.conversationId} AND user_id = ${input.senderId}
    `;

    return { id: inserted[0]!.id as string };
  });
}

/** Mark a conversation as read up to now for a participant. */
export async function markConversationRead(input: {
  conversationId: string;
  userId: string;
}): Promise<void> {
  await db`
    UPDATE conversation_participant SET last_read_at = NOW()
    WHERE conversation_id = ${input.conversationId} AND user_id = ${input.userId}
  `;
}
