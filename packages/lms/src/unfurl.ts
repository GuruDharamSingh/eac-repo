// Moved to @elkdonis/utils/unfurl (shared). Re-exported so lms callers do not change.
// The Sophia user agent this module used to send is kept here as the default for lms.
import { unfurl as baseUnfurl, type Unfurled } from '@elkdonis/utils/unfurl';

export { assertPublicUrl, type Unfurled, type UnfurlOptions } from '@elkdonis/utils/unfurl';

export const unfurl = (raw: string, opts: { userAgent?: string } = {}): Promise<Unfurled> =>
  baseUnfurl(raw, { userAgent: 'SophiaLinkPreview/1.0 (+https://sophia.arts-collective.com)', ...opts });
