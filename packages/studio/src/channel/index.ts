// Channel console: a per-org or per-person view of what is posted where.
// Server-renderable (no client state); the host loads ChannelData and passes
// a "Post this" server action. docs/open/CHANNEL_CONSOLE_2026-11-07.md.
export * from "./types";
export * from "./nav";
export { ChannelConsole } from "./ChannelConsole";
