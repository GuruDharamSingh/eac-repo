/**
 * @elkdonis/messaging — internal user-to-user messaging for the monorepo.
 *
 * - Types:   `@elkdonis/messaging` (this entry) or `@elkdonis/messaging/types`
 * - Reads:   `@elkdonis/messaging/queries`
 * - Writes:  `@elkdonis/messaging/server` (server actions / API routes only)
 */

export * from "./types";
export {
  getUnreadCount,
  listConversationsForUser,
  getConversationThread,
} from "./queries";
