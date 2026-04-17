import type { Organization } from './organization';
import type { UserSummary } from './user';
import type { Media } from './media';

export type WorkshopStatus = 'draft' | 'published' | 'completed' | 'archived';
export type WorkshopVisibility = 'PUBLIC' | 'ORGANIZATION' | 'INVITE_ONLY';

export interface WorkshopSession {
  id: string;
  workshopId: string;
  title: string;
  description?: string;
  scheduledAt: Date;
  durationMinutes?: number;
  location?: string;
  isOnline: boolean;
  meetingUrl?: string;
  recordingUrl?: string;
  resources?: WorkshopResource[];
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkshopResource {
  id: string;
  title: string;
  type: 'link' | 'pdf' | 'video' | 'audio' | 'other';
  url: string;
  isPublic: boolean; // If false, only visible to joined members
  description?: string;
}

export interface Workshop {
  id: string;
  orgId: string;
  guideId: string;
  title: string;
  slug: string;
  description?: string;
  pitch?: string; // Long form markdown/html for the "Sales" part
  
  // Visuals
  flyerImage?: Media;
  flyerImageId?: string;
  
  status: WorkshopStatus;
  visibility: WorkshopVisibility;
  
  // Pricing & RSVP
  price?: number;
  currency?: string;
  isRSVPEnabled: boolean;
  attendeeLimit?: number;
  attendeeCount?: number;
  
  // Nextcloud integration
  nextcloudFolderId?: string;
  
  // Timestamps
  createdAt: Date;
  publishedAt?: Date;
  updatedAt: Date;
  
  // Counters
  viewCount: number;
  replyCount: number;

  // Relations
  organization?: Organization;
  guide?: UserSummary;
  sessions?: WorkshopSession[];
  globalResources?: WorkshopResource[];
}
