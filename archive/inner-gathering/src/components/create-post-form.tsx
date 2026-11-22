"use client";

import { useEffect, useState } from "react";
import { PostForm, type PostFormData } from "@elkdonis/ui";
import { createPostAction } from "@/lib/actions";
import { getSession } from "@elkdonis/auth-client";

interface CreatePostFormProps {
  onSuccess?: () => void;
}

export function CreatePostForm({ onSuccess }: CreatePostFormProps) {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Get current auth user
    const fetchUserId = async () => {
      try {
        const { user } = await getSession();

        if (!user) {
          console.error('No user session found');
          return;
        }

        // Use user ID directly from session
        setUserId(user.id);
      } catch (err) {
        console.error('Error fetching user ID:', err);
      }
    };

    fetchUserId();
  }, []);

  const handleSubmit = async (formData: PostFormData) => {
    if (!userId) {
      throw new Error("You must be logged in to create a post");
    }

    // Upload media if provided
    const uploadedMedia: Array<{
      fileId: string;
      path: string;
      url: string;
      filename: string;
      mimeType: string;
      size: number;
      type: "image" | "video" | "audio" | "document";
    }> = [];

    for (const file of formData.media) {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('userId', userId);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload media');
      }

      const uploadJson = await uploadResponse.json();
      if (
        !uploadJson?.success ||
        !uploadJson?.fileId ||
        !uploadJson?.path ||
        !uploadJson?.url ||
        !uploadJson?.mediaType
      ) {
        throw new Error('Invalid response from upload service');
      }

      uploadedMedia.push({
        fileId: uploadJson.fileId,
        path: uploadJson.path,
        url: uploadJson.url,
        filename: uploadJson.filename,
        mimeType: uploadJson.mimeType,
        size: uploadJson.size,
        type: uploadJson.mediaType,
      });
    }

    // Create collaborative document if requested
    let documentUrl: string | undefined;
    if (formData.createDocument) {
      const docResponse = await fetch('/api/create-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orgId: 'inner_group',
          meetingTitle: formData.title.trim(),
          meetingId: `post-${Date.now()}`,
        }),
      });

      if (docResponse.ok) {
        const docJson = await docResponse.json();
        if (docJson?.success && docJson?.url) {
          documentUrl = docJson.url;
        }
      }
    }

    await createPostAction({
      userId: userId,
      title: formData.title,
      body: formData.body,
      excerpt: formData.excerpt || undefined,
      visibility: formData.visibility,
      media: uploadedMedia.length > 0 ? uploadedMedia : undefined,
      documentUrl,
      createTalkRoom: formData.createTalkRoom,
    });
  };

  return <PostForm onSubmit={handleSubmit} onSuccess={onSuccess} />;
}

