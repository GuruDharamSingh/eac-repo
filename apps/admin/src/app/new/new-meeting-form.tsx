"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { MeetingForm, type MeetingFormData } from "@elkdonis/ui";
import { createMeetingAction } from "@/lib/actions";
import type { Organization } from "@elkdonis/types";

interface NewMeetingFormProps {
  organizations: Organization[];
}

export function NewMeetingForm({ organizations }: NewMeetingFormProps) {
  const router = useRouter();

  const orgOptions = useMemo(
    () => organizations.map((org) => ({ value: org.id, label: org.name })),
    [organizations]
  );

  const handleSubmit = async (formData: MeetingFormData) => {
    const durationMinutes =
      typeof formData.durationMinutes === "string"
        ? parseInt(formData.durationMinutes, 10)
        : formData.durationMinutes;

    await createMeetingAction({
      title: formData.title.trim(),
      slug: formData.slug.trim(),
      orgId: formData.orgId,
      guideId: formData.guideId.trim(),
      meetingType: formData.meetingType,
      description: formData.description.trim() || undefined,
      scheduledAt:
        formData.scheduledAt instanceof Date
          ? formData.scheduledAt.toISOString()
          : undefined,
      durationMinutes: isNaN(durationMinutes) ? undefined : durationMinutes,
      location: formData.location.trim(),
      isOnline: formData.isOnline,
      meetingUrl: formData.meetingUrl.trim() || undefined,
      visibility: formData.visibility,
      notes: formData.notes.trim() || undefined,
    });
  };

  const handleSuccess = () => {
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <MeetingForm
      config={{
        organizationOptions: orgOptions,
        // All fields visible, only title and date/time required
        visibleFields: {
          title: true,
          slug: true,
          orgId: true,
          guideId: true,
          meetingType: true,
          description: true,
          scheduledAt: true,
          durationMinutes: true,
          location: true,
          isOnline: true,
          meetingUrl: true,
          visibility: true,
          notes: true,
          media: false,
        },
        requiredFields: {
          title: true,
          scheduledAt: true,
        },
      }}
      onSubmit={handleSubmit}
      onSuccess={handleSuccess}
      submitButtonText="Create Meeting"
    />
  );
}
