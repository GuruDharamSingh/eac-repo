"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import type {
  ContentDraft,
  ContentFormKind,
  ThreadKind,
  UploadedMedia,
  WorkshopSessionDraft,
} from "@elkdonis/types";
import type { SelectedNextcloudFile } from "./useMeetingForm";

export type { SelectedNextcloudFile };

const EMPTY_DRAFT: ContentDraft = {
  title: "",
  body: "",
  isMeeting: false,
  primaryOrgId: "",
};

export interface UseContentDraftConfig {
  orgId: string;
  userId: string;
  initialDraft?: Partial<ContentDraft>;
  initialThreadId?: string;
  uploadEndpoint?: string;
  publishEndpoint?: string;
  onPublished?: (threadId: string, kind: ThreadKind) => void;
  onSaveDraft?: (draft: ContentDraft) => void;
}

export interface UseContentDraftResult {
  kind: ContentFormKind;
  setKind: (k: ContentFormKind) => void;

  draft: ContentDraft;
  update: (patch: Partial<ContentDraft>) => void;

  addSession: () => void;
  updateSession: (id: string, patch: Partial<WorkshopSessionDraft>) => void;
  removeSession: (id: string) => void;

  mediaFiles: File[];
  setMediaFiles: Dispatch<SetStateAction<File[]>>;
  libraryFiles: SelectedNextcloudFile[];
  addLibraryFile: (f: SelectedNextcloudFile) => void;
  removeLibraryFile: (index: number) => void;

  createTalkRoom: boolean;
  setCreateTalkRoom: Dispatch<SetStateAction<boolean>>;
  createDocument: boolean;
  setCreateDocument: Dispatch<SetStateAction<boolean>>;
  documentUrl: string;
  setDocumentUrl: Dispatch<SetStateAction<string>>;

  publishing: boolean;
  savingDraft: boolean;
  error: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
  draftSavedAt: Date | null;

  validate: () => string | null;
  handlePublish: () => Promise<void>;
  handleSaveDraft: () => Promise<void>;
}

export function useContentDraft(config: UseContentDraftConfig): UseContentDraftResult {
  const {
    orgId,
    userId,
    initialDraft,
    initialThreadId,
    uploadEndpoint = "/api/upload",
    publishEndpoint = "/api/content",
    onPublished,
    onSaveDraft,
  } = config;

  const [kind, setKind] = useState<ContentFormKind>("post");
  const [draft, setDraft] = useState<ContentDraft>(() => ({
    ...EMPTY_DRAFT,
    primaryOrgId: orgId,
    ...initialDraft,
  }));
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [libraryFiles, setLibraryFiles] = useState<SelectedNextcloudFile[]>([]);
  const [createTalkRoom, setCreateTalkRoom] = useState(false);
  const [createDocument, setCreateDocument] = useState(false);
  const [documentUrl, setDocumentUrl] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);

  const update = (patch: Partial<ContentDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  // Session helpers
  const sessions = draft.sessions ?? [];

  const addSession = () => {
    const next: WorkshopSessionDraft = {
      id: `sess_${Date.now()}`,
      title: "",
      orderIndex: sessions.length,
    };
    update({ sessions: [...sessions, next] });
  };

  const updateSession = (id: string, patch: Partial<WorkshopSessionDraft>) => {
    update({ sessions: sessions.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  };

  const removeSession = (id: string) => {
    update({ sessions: sessions.filter((s) => s.id !== id) });
  };

  // Library file helpers
  const addLibraryFile = (f: SelectedNextcloudFile) => {
    setLibraryFiles((prev) => [...prev, f]);
  };

  const removeLibraryFile = (index: number) => {
    setLibraryFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = (): string | null => {
    if (!draft.title.trim()) return "Title is required";
    return null;
  };

  const uploadMedia = async (files: File[]): Promise<UploadedMedia[]> => {
    if (files.length === 0) return [];
    const uploaded: UploadedMedia[] = [];
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("userId", userId);
      const res = await fetch(uploadEndpoint, { method: "POST", body: fd });
      if (!res.ok) throw new Error(`Failed to upload ${file.name}`);
      const json = await res.json();
      if (!json?.fileId || !json?.url) throw new Error("Invalid upload response");
      uploaded.push({
        fileId: json.fileId,
        path: json.path,
        url: json.url,
        filename: json.filename,
        mimeType: json.mimeType,
        size: json.size,
        type: json.mediaType,
      });
    }
    return uploaded;
  };

  const buildPayload = (uploadedMedia: UploadedMedia[], resolvedDocUrl?: string): Record<string, unknown> => ({
    ...draft,
    kind,
    isMeeting: kind === "meeting" || kind === "workshop" ? true : draft.isMeeting,
    userId,
    threadId: initialThreadId,
    media: [
      ...uploadedMedia,
      ...libraryFiles.map((f) => ({
        fileId: f.filename,
        path: f.basename,
        url: f.url,
        filename: f.filename,
        mimeType: f.mime ?? "application/octet-stream",
        size: f.size,
        type: "document" as const,
      })),
    ],
    documentUrl: resolvedDocUrl || documentUrl || undefined,
    createTalkRoom,
  });

  const handlePublish = async () => {
    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setPublishing(true);
    try {
      // Create living document if requested (before publishing so we have the URL)
      let resolvedDocumentUrl = documentUrl;
      if (createDocument && draft.title.trim()) {
        const docRes = await fetch("/api/create-document", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orgId,
            meetingTitle: draft.title.trim(),
            meetingId: `${kind}-${Date.now()}`,
          }),
        });
        if (docRes.ok) {
          const docData = await docRes.json();
          if (docData.success && docData.url) {
            resolvedDocumentUrl = docData.url;
            setDocumentUrl(docData.url);
          }
        }
      }

      const uploaded = await uploadMedia(mediaFiles);
      const res = await fetch(publishEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(uploaded, resolvedDocumentUrl)),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Publish failed (${res.status})`);
      }
      const data = (await res.json()) as { id: string; kind: ThreadKind };
      onPublished?.(data.id, data.kind);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to publish");
    } finally {
      setPublishing(false);
    }
  };

  const handleSaveDraft = async () => {
    setError(null);
    setSavingDraft(true);
    try {
      await onSaveDraft?.({ ...draft });
      setDraftSavedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save draft");
    } finally {
      setSavingDraft(false);
    }
  };

  return {
    kind,
    setKind,
    draft,
    update,
    addSession,
    updateSession,
    removeSession,
    mediaFiles,
    setMediaFiles,
    libraryFiles,
    addLibraryFile,
    removeLibraryFile,
    createTalkRoom,
    setCreateTalkRoom,
    createDocument,
    setCreateDocument,
    documentUrl,
    setDocumentUrl,
    publishing,
    savingDraft,
    error,
    setError,
    draftSavedAt,
    validate,
    handlePublish,
    handleSaveDraft,
  };
}
