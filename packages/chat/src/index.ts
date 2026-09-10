// ============================================================================
// @elkdonis/chat — the org's General Chat, shared across hubs.
//
// Every org's chat is a Nextcloud Talk room (organizations.talk_room_token).
// The Talk logic is org-scoped in @elkdonis/services/org-chat.ts; this package
// is the UI and the route factory, owned once so a fix reaches every hub —
// the lesson @elkdonis/pipeline was extracted to learn.
//
// The thing worth knowing before changing anything here: members post under
// their own names because each holds a Talk GUEST session (migration 102), not
// because they have Nextcloud accounts. Reads go over the service account.
// ============================================================================

export { ChatCard } from "./components/ChatCard";
export { ChatPage } from "./components/ChatPage";
export { ChatTranscript } from "./components/ChatTranscript";
export { ChatIdentity } from "./components/ChatIdentity";
export { ProvisionChat } from "./components/ProvisionChat";
