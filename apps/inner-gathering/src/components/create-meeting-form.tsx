"use client";

import { useEffect, useState } from "react";
import { MeetingForm, type MeetingFormData } from "@elkdonis/ui";
import { createMeetingAction } from "@/lib/actions";
import { getSession } from "@elkdonis/auth-client";

interface CreateMeetingFormProps {
  onSuccess?: () => void;
}

const ORG_ID = "inner_group";

export function CreateMeetingForm({ onSuccess }: CreateMeetingFormProps) {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Get current auth user
    const fetchUserId = async () => {
      try {
        const { user } = await getSession();

        console.log('Auth check:', { user });

        if (!user) {
          console.error('No user session found');
          return;
        }

        // Use user ID directly from session
        console.log('Setting userId to:', user.id);
        setUserId(user.id);
      } catch (err) {
        console.error('Error fetching user ID:', err);
      }
    };

    fetchUserId();
  }, []);

  const handleSubmit = async (formData: MeetingFormData) => {
    if (!userId) {
      throw new Error("You must be logged in to create a meeting");
    }

    const durationMinutes =
      typeof formData.durationMinutes === "string"
        ? parseInt(formData.durationMinutes, 10)
        : formData.durationMinutes;

    const scheduledAt = formData.scheduledAt instanceof Date
      ? formData.scheduledAt
      : new Date();

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
    let documentData: { fileId: string; url: string } | undefined;
    if (formData.createDocument) {
      const docResponse = await fetch('/api/create-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orgId: ORG_ID,
          meetingTitle: formData.title.trim(),
          meetingId: `temp-${Date.now()}`, // Will be replaced with actual ID
        }),
      });

      if (docResponse.ok) {
        const docJson = await docResponse.json();
        if (docJson?.success && docJson?.fileId && docJson?.url) {
          documentData = {
            fileId: docJson.fileId,
            url: docJson.url,
          };
        }
      }
    }

    await createMeetingAction({
      userId,
      title: formData.title.trim(),
      scheduledAt,
      durationMinutes,
      location: formData.location?.trim(),
      description: formData.description?.trim() || undefined,
      visibility: formData.visibility || "ORGANIZATION",
      isOnline: formData.isOnline,
      meetingUrl: formData.meetingUrl?.trim() || undefined,
      media: uploadedMedia.length > 0 ? uploadedMedia : undefined,
      nextcloudDocumentId: documentData?.fileId,
      documentUrl: documentData?.url,
      syncToCalendar: formData.syncToCalendar,
      createTalkRoom: formData.createTalkRoom ?? formData.isOnline, // Auto-create Talk room for online meetings
    });
  };

  return (
    <MeetingForm
      config={{
        // Fixed org to inner_group
        fixedValues: {
          orgId: ORG_ID,
          visibility: "PUBLIC",
        },
        // All fields visible, only title and date/time required
        visibleFields: {
          title: true,
          slug: true,
          orgId: true,
          guideId: true,
          description: true,
          scheduledAt: true,
          durationMinutes: true,
          location: true,
          isOnline: true,
          meetingUrl: true,
          visibility: true,
          notes: true,
          media: true,
          createDocument: true,
        },
        requiredFields: {
          title: true,
          scheduledAt: true,
        },
      }}
      onSubmit={handleSubmit}
      onSuccess={onSuccess}
      submitButtonText="Create Meeting"
    />
  );
}
