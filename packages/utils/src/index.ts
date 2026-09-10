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