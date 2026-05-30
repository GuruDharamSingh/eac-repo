import type { ThreadKind, ContentDraft } from "@elkdonis/types";

export type {
  ThreadKind,
  ContentFormKind,
  ExtraField,
  WorkshopSessionDraft,
  ContentDraft,
  UploadedMedia,
} from "@elkdonis/types";

export type TierName = "post" | "schedule" | "rsvp" | "workshop";

export interface KindInferenceResult {
  kind: ThreadKind;
  reason: string;
}

export interface ContentFormProps {
  orgId: string;
  isCmsSite?: boolean;
  allowedOrgs?: { id: string; name: string }[];
  userId: string;
  isAdmin?: boolean;
  initialDraft?: Partial<ContentDraft>;
  initialThreadId?: string;
  onPublished?: (threadId: string, kind: ThreadKind) => void;
  onSaveDraft?: (draft: ContentDraft) => void;
}
