import type * as React from 'react';
import type { HubCardHost } from '../contract';

/** What the Members card needs beyond the shared host. */
export interface MembersHost extends HubCardHost {
  /**
   * The org's shared-storage controls (the old Cloud storage panel). Drawn under
   * "Shared storage" on the Permissions tab for viewers who may see storage. Hidden when absent.
   */
  storagePanel?: React.ReactNode;
  /** The full analytics page. Owners only; hidden when null or absent. */
  analyticsHref?: string | null;
}
