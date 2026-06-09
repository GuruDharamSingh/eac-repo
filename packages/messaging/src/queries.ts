/**
 * Read-side queries for the messaging domain. Safe to call from server
 * components / API routes. All participant-scoped reads take the viewing
 * user's id and only return threads they belong to.
 */

import { db } from "@elkdonis/db";
import type {
  ConversationSummary,
  ConversationThread,
  MessageParticipant,
  Message,
} from "./types";

type Row = Record<string, unknown>;
const opt = <T>(v: unknown): T | null => (v == null ? null : (v as T));
const num = (v: unknown): number => (v == null ? 0 : Number(v));

/** Total unread messages for a user across all their conversations. */
export async function getUnreadCount(userId: string): Promise<number> {
  const rows = (await db`
    SELECT COUNT(*)::int AS n
    FROM message m
    JOIN conversation_participant p
      ON p.conversation_id = m.conversation_id AND p.user_id = ${userId}
    WHERE m.sender_id <> ${userId}
      AND (p.last_read_at IS NULL OR m.created_at > p.last_read_at)
  `) as unknown as Row[];
  return num(rows[0]?.n);
}

/** A user's inbox — conversations they're in, most recently active first. */
export async function listConversationsForUser(
  userId: string,
  opts: { limit?: number } = {}
): Promise<ConversationSummary[]> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const rows = (await db`
    SELECT
      c.id, c.subject, c.context_type, c.context_id,
      c.created_at, c.last_message_at,
      lm.body AS last_body, lm.sender_id AS last_sender_id,
      (
        SELECT COUNT(*)::int FROM message m2
        WHERE m2.conversation_id = c.id
          AND m2.sender_id <> ${userId}
          AND (me.last_read_at IS NULL OR m2.created_at > me.last_read_at)
      ) AS unread_count
    FROM conversation c
    JOIN conversation_participant me
      ON me.conversation_id = c.id AND me.user_id = ${userId}
    LEFT JOIN LATERAL (
      SELECT body, sender_id FROM message
      WHERE conversation_id = c.id
      ORDER BY created_at DESC LIMIT 1
    ) lm ON true
    ORDER BY c.last_message_at DESC
    LIMIT ${limit}
  `) as unknown as Row[];

  if (rows.length === 0) return [];

  // Fetch the "other" participants for all listed conversations in one query.
  const ids = rows.map((r) => r.id as string);
  const partRows = (await db`
    SELECT
      p.conversation_id, p.user_id, p.last_read_at,
      u.display_name, u.email
    FROM conversation_participant p
    JOIN users u ON u.id = p.user_id
    WHERE p.conversation_id = ANY(${ids}) AND p.user_id <> ${userId}
  `) as unknown as Row[];

  const othersByConvo = new Map<string, MessageParticipant[]>();
  for (const p of partRows) {
    const cid = p.conversation_id as string;
    const list = othersByConvo.get(cid) ?? [];
    list.push({
      userId: p.user_id as string,
      displayName: opt(p.display_name),
      email: opt(p.email),
      lastReadAt: opt(p.last_read_at),
    });
    othersByConvo.set(cid, list);
  }

  return rows.map((r) => ({
    id: r.id as string,
    subject: opt(r.subject),
    context:
      r.context_type != null
        ? { type: r.context_type as string, id: (r.context_id as string) ?? "" }
        : null,
    createdAt: r.created_at as string,
    lastMessageAt: r.last_message_at as string,
    others: othersByConvo.get(r.id as string) ?? [],
    lastMessagePreview: opt(r.last_body),
    lastMessageSenderId: opt(r.last_sender_id),
    unreadCount: num(r.unread_count),
  }));
}

/**
 * Full thread (participants + messages) for a conversation, but only if the
 * given user is a participant. Returns null otherwise (acts as the authz gate).
 */
export async function getConversationThread(
  conversationId: string,
  userId: string,
  opts: { limit?: number } = {}
): Promise<ConversationThread | null> {
  const limit = Math.min(opts.limit ?? 200, 500);

  const convoRows = (await db`
    SELECT c.id, c.subject, c.context_type, c.context_id,
           c.created_at, c.last_message_at
    FROM conversation c
    JOIN conversation_participant p
      ON p.conversation_id = c.id AND p.user_id = ${userId}
    WHERE c.id = ${conversationId}
    LIMIT 1
  `) as unknown as Row[];
  if (!convoRows[0]) return null;
  const c = convoRows[0];

  const [participantRows, messageRows] = await Promise.all([
    db`
      SELECT p.user_id, p.last_read_at, u.display_name, u.email
      FROM conversation_participant p
      JOIN users u ON u.id = p.user_id
      WHERE p.conversation_id = ${conversationId}
    ` as Promise<unknown> as Promise<Row[]>,
    db`
      SELECT m.id, m.conversation_id, m.sender_id, m.body, m.created_at,
             u.display_name AS sender_name
      FROM message m
      JOIN users u ON u.id = m.sender_id
      WHERE m.conversation_id = ${conversationId}
      ORDER BY m.created_at ASC
      LIMIT ${limit}
    ` as Promise<unknown> as Promise<Row[]>,
  ]);

  const participants: MessageParticipant[] = participantRows.map((p) => ({
    userId: p.user_id as string,
    displayName: opt(p.display_name),
    email: opt(p.email),
    lastReadAt: opt(p.last_read_at),
  }));

  const messages: Message[] = messageRows.map((m) => ({
    id: m.id as string,
    conversationId: m.conversation_id as string,
    senderId: m.sender_id as string,
    body: m.body as string,
    createdAt: m.created_at as string,
    senderName: opt(m.sender_name),
  }));

  return {
    id: c.id as string,
    subject: opt(c.subject),
    context:
      c.context_type != null
        ? { type: c.context_type as string, id: (c.context_id as string) ?? "" }
        : null,
    createdAt: c.created_at as string,
    lastMessageAt: c.last_message_at as string,
    participants,
    messages,
  };
}
