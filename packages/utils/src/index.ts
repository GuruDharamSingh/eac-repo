// API Response helpers
export {
  apiSuccess,
  apiError,
  ApiErrors,
  type ApiSuccessResponse,
  type ApiErrorResponse,
  type ApiResponse,
} from './api-response';

// String utilities
export { slugify, formatFileSize, truncate, deriveExcerpt } from './strings';

// Slugs no person or org may take — shared by users.slug, organizations.slug,
// and the arts-collective middleware's reserved subdomains (pure, Edge-safe).
export { RESERVED_SLUGS, isReservedSlug } from './reserved-slugs';

// HTML sanitization for rich-text content
export { sanitizeRichText, sanitizePostBody } from './sanitize';

// HTML sanitization for Silex-published org sites
export { sanitizeSilexHtml } from './sanitize-silex';

// Magic-byte upload validation
export {
  sniffFileType,
  looksLikeText,
  validateUploadBuffer,
  type SniffedKind,
  type SniffedType,
  type UploadValidation,
} from './file-validation';

// Date utilities
export { formatTime, formatDate, isPastDate, getRelativeTime } from './dates';

// Constants
export {
  VISIBILITY_OPTIONS,
  DEFAULT_MEETING_DURATION,
  NEXTCLOUD_DEFAULT_URL,
  POLL_INTERVAL
} from './constants';

// Recurring-meeting cycle math (pure — safe to import from client components)
export {
  recurrenceIntervalMs,
  lastOccurrenceEnd,
  nextOccurrence,
  isWithinCurrentCycle,
  // Calendar-grid expansion — one recurring thread becomes many cells.
  expandOccurrences,
  occurrencesByDay,
  monthGrid,
  dayKey,
  startOfMonth,
  addMonths,
  type RecurrencePattern,
  type Occurring,
  type Occurrence,
} from './recurrence';
// Render-time transforms for wiki bodies. Pure string work, shared because
// two surfaces render the same stored page at different routes: the stored
// body carries link TARGETS (data-wiki-slug), never hrefs, so whoever renders
// it decides where a wikilink points. The forum serves /wiki/… and owns editing;
// an org site's /forum/wiki/… is the same page — one transform, any basePath.
export { renderWikiBody } from './wiki-render';
export type { WikiHeading } from './wiki-render';
