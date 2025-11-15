/**
 * Nextcloud React Components
 *
 * Optional UI components for embedding Nextcloud features
 * Only import in apps that need UI components
 *
 * NOTE: The iframe embed components (PollsEmbed, CalendarEmbed) are
 * experimental and NOT recommended for production use. We found iframes
 * too finicky and are using the hybrid approach instead (custom UI + API).
 *
 * Recommended approach:
 * - For Polls: Use custom components with /api/polls endpoints
 * - For Calendar: Build custom UI that syncs to Nextcloud via CalDAV API
 * - For Talk: TalkEmbed may still be useful for video embedding
 */

export * from './TalkEmbed';
export * from './FileUploader';

// Iframe embed components - kept for reference but not recommended
// Prefer hybrid approach: custom UI + Nextcloud API backend
export * from './NextcloudEmbed';
export * from './PollsEmbed';
export * from './CalendarEmbed';
