'use client';

import { useState } from 'react';
import { Alert } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { BlogEntryForm, type BlogEntryFormData } from '@elkdonis/ui';
import type { BlogPostSubmission, UploadedMedia } from '../types';

interface BlogPostEditorProps {
  orgId: string;
  userId: string;
  uploadEndpoint: string;
  onSubmit: (payload: BlogPostSubmission) => Promise<void>;
  orgName?: string;
  initialValues?: Partial<BlogEntryFormData>;
  submitLabel?: string;
}

interface UploadResponse {
  success: boolean;
  id: string;
  fileId: string;
  path: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  mediaType: UploadedMedia['type'];
}

export function BlogPostEditor({
  orgId,
  orgName,
  userId,
  uploadEndpoint,
  onSubmit,
  initialValues,
  submitLabel = 'Publish Post',
}: BlogPostEditorProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (values: BlogEntryFormData) => {
    setError(null);
    setIsSubmitting(true);

    try {
      const uploadedMedia = await uploadMediaFiles(values.media, {
        uploadEndpoint,
        orgId,
        userId,
      });

      const metadata: Record<string, unknown> = {
        link: values.link || null,
        tags: values.tags,
        createForumThread: values.createForumThread,
        forumThreadTitle: values.forumThreadTitle || null,
      };

      await onSubmit({
        title: values.title.trim(),
        body: values.body,
        excerpt: values.excerpt?.trim() || undefined,
        link: values.link?.trim() || undefined,
        tags: values.tags,
        createForumThread: values.createForumThread,
        forumThreadTitle: values.forumThreadTitle?.trim() || undefined,
        metadata,
        media: uploadedMedia,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to publish post. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Submission failed"
          color="red"
          variant="light"
        >
          {error}
        </Alert>
      ) : null}

      <BlogEntryForm
        onSubmit={handleSubmit}
        initialValues={initialValues}
        submitLabel={submitLabel}
        orgName={orgName}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}

async function uploadMediaFiles(
  files: File[],
  options: { uploadEndpoint: string; orgId: string; userId: string }
): Promise<UploadedMedia[]> {
  if (!files?.length) return [];

  const uploads: UploadedMedia[] = [];

  for (const file of files) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('orgId', options.orgId);
    formData.append('userId', options.userId);

    const response = await fetch(options.uploadEndpoint, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload ${file.name}`);
    }

    const json = (await response.json()) as UploadResponse;
    if (!json.success) {
      throw new Error(json?.filename ? `Failed to upload ${json.filename}` : 'Upload failed');
    }

    uploads.push({
      id: json.id,
      fileId: json.fileId,
      path: json.path,
      url: json.url,
      filename: json.filename,
      mimeType: json.mimeType,
      size: json.size,
      type: json.mediaType,
    });
  }

  return uploads;
}
