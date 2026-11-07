import type { StudioResult, StudioShare, StudioShareTarget } from '../types';

// The Post kind's contract with its host (2026-10-31). Structurally the
// services' SocialPost; this package has no services dependency.

export type PostPlatform = 'facebook' | 'instagram' | 'threads';

export interface PostImage {
  url: string;
  alt?: string | null;
}

export interface SocialPostView {
  id: string;
  orgId: string;
  title: string;
  body: string;
  link: string | null;
  images: PostImage[];
  variants: Partial<Record<PostPlatform, { text?: string | null }>>;
  shares: StudioShare[];
  createdAt: string;
  updatedAt: string;
}

export interface SocialPostPatchView {
  title?: string;
  body?: string;
  link?: string | null;
  images?: PostImage[];
  variants?: SocialPostView['variants'];
}

export interface PostActions {
  listPosts(orgId: string): Promise<SocialPostView[]>;
  createPost(orgId: string): Promise<StudioResult<SocialPostView>>;
  savePost(id: string, patch: SocialPostPatchView): Promise<StudioResult<SocialPostView>>;
  archivePost(id: string): Promise<StudioResult>;
  listShareTargets(): Promise<StudioShareTarget[]>;
  /** Post to one connected account now; the share comes back recorded. */
  publishPost(id: string, targetId: string): Promise<StudioResult<StudioShare>>;
}

export interface PostKindProps {
  initialPosts: SocialPostView[];
  initialPostId: string | null;
  actions: PostActions;
  /** POST multipart `file` + `orgSlug` + `context`; answers `{ url }` (an /api/media path). */
  uploadEndpoint: string;
  /** The host's sharp route (arts-collective /api/studio/image): opens pictures in the editor at a working size, makes JPEGs. */
  imageEndpoint?: string;
  links: { connectionsHref?: string };
}

export const POST_LIMITS: Record<PostPlatform, number> = { facebook: 63_206, instagram: 2_200, threads: 500 };
export const POST_PLATFORM_LABEL: Record<PostPlatform, string> = { facebook: 'Facebook', instagram: 'Instagram', threads: 'Threads' };
