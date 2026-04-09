import type { Organization } from './organization';
import type { User } from './user';

export type MediaType = 'image' | 'video' | 'audio' | 'document';
export type MediaAttachedToType = 'meeting' | 'post';

export interface Media {
  id: string;
  orgId: string;
  uploadedBy: string;
  attachedToType?: MediaAttachedToType;
  attachedToId?: string;
  nextcloudFileId: string;
  nextcloudPath: string;
  url: string;
  type?: MediaType;
  filename?: string;
  sizeBytes?: number;
  mimeType?: string;
  caption?: string;
  altText?: string;
  createdAt: Date;
  organization?: Organization;
  uploader?: User;
}
