'use client';

import { useEffect, useState } from 'react';
import { Select, Stack, Text } from '@mantine/core';
import { MeetingForm, type MeetingFormData } from '@elkdonis/ui';
import { createMeetingAction } from '@/lib/actions';
import { getSession } from '@elkdonis/auth-client';
import { siteConfig } from '@/config/site';

const SECTION_OPTIONS = [
  { value: 'amrit_vela', label: 'Amrit Vela Sadhana' },
  { value: 'yoga', label: 'Yoga Classes' },
  { value: 'gurdwara', label: 'Gurdwara / Langar' },
];

interface AdminMeetingFormProps {
  onSuccess?: () => void;
}

const ORG_ID = siteConfig.orgId;

export function AdminMeetingForm({ onSuccess }: AdminMeetingFormProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [section, setSection] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserId = async () => {
      try {
        const session = await getSession();
        if (session?.user) {
          setUserId(session.user.db_user_id || session.user.id);
        }
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
      : formData.scheduledAt
        ? new Date(formData.scheduledAt)
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
      uploadFormData.append('visibility', formData.visibility);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to upload media');
      }

      const uploadJson = await uploadResponse.json();
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

    await createMeetingAction({
      userId,
      title: formData.title.trim(),
      scheduledAt,
      durationMinutes,
      location: formData.location?.trim(),
      description: formData.description?.trim(),
      visibility: formData.visibility || "PUBLIC",
      isOnline: formData.isOnline,
      meetingUrl: formData.meetingUrl?.trim(),
      media: uploadedMedia.length > 0 ? uploadedMedia : undefined,
      isRSVPEnabled: formData.isRSVPEnabled,
      rsvpDeadline: formData.rsvpDeadline || undefined,
      minAttendees: formData.minAttendees ? Number(formData.minAttendees) : undefined,
      notifyOnMinAttendees: formData.notifyOnMinAttendees,
      recurrencePattern: formData.recurrencePattern !== "NONE" ? formData.recurrencePattern : undefined,
      recurrenceCustomRule: formData.recurrenceCustomRule?.trim() || undefined,
      recurrenceUntil: formData.recurrenceUntil || undefined,
      section: section || undefined,
    });
  };

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Text size="sm" fw={600}>Section</Text>
        <Select
          placeholder="Choose a section…"
          data={SECTION_OPTIONS}
          value={section}
          onChange={setSection}
          clearable
          styles={{
            input: { backgroundColor: '#fff', color: '#212529' },
            dropdown: { backgroundColor: '#fff' },
            option: { color: '#212529' },
          }}
        />
        <Text size="xs" c="dimmed">
          Assigns this meeting to a section page (Amrit Vela, Yoga, or Gurdwara).
        </Text>
      </Stack>

      <MeetingForm
      orgId={ORG_ID}
      config={{
        fixedValues: {
          orgId: ORG_ID,
          visibility: "PUBLIC",
        },
        visibleFields: {
          title: true,
          description: true,
          scheduledAt: true,
          durationMinutes: true,
          location: true,
          isOnline: true,
          meetingUrl: true,
          visibility: true,
          notes: true,
          media: true,
          isRSVPEnabled: true,
          rsvpDeadline: true,
          minAttendees: true,
          notifyOnMinAttendees: true,
          recurrencePattern: true,
          recurrenceCustomRule: true,
          recurrenceUntil: true,
        },
        requiredFields: {
          title: true,
          scheduledAt: true,
        },
      }}
      onSubmit={handleSubmit}
      onSuccess={onSuccess}
      submitButtonText="Schedule Session"
    />
    </Stack>
  );
}
