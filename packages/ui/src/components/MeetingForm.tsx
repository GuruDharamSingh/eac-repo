"use client";

import {
  Button,
  Checkbox,
  Group,
  NumberInput,
  Paper,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Divider,
  Box,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { Calendar, Settings, FileText, Image as ImageIcon } from "lucide-react";
import { useMeetingForm, type MeetingFormData, type MeetingFormConfig } from "@elkdonis/hooks";
import { VISIBILITY_OPTIONS } from "@elkdonis/utils";
import { MediaUpload } from "./MediaUpload";

export { type MeetingFormData, type MeetingFormConfig } from "@elkdonis/hooks";

export interface MeetingFormProps {
  config?: MeetingFormConfig;
  onSubmit: (data: MeetingFormData) => Promise<void>;
  onSuccess?: () => void;
  submitButtonText?: string;
}

export function MeetingForm({
  config = {},
  onSubmit,
  onSuccess,
  submitButtonText = "Create Meeting"
}: MeetingFormProps) {
  const {
    formData,
    isSubmitting,
    setIsSubmitting,
    error,
    setError,
    isFormValid,
    handleChange,
    validateForm,
    mergedConfig,
  } = useMeetingForm(config);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit(formData);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create meeting");
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasOrgs = (mergedConfig.organizationOptions?.length ?? 0) > 0;

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="lg">
        {/* Basic Information */}
        {(mergedConfig.visibleFields?.title ||
          mergedConfig.visibleFields?.slug ||
          mergedConfig.visibleFields?.description) && (
          <FormSection title="Basic Information" icon={<Calendar size={16} />}>
            <Stack gap="md">
              {mergedConfig.visibleFields?.title && (
                <TextInput
                  label="Meeting Title"
                  placeholder="Enter meeting title"
                  required={mergedConfig.requiredFields?.title}
                  value={formData.title}
                  onChange={(e) => handleChange("title", e.currentTarget.value)}
                />
              )}

              {mergedConfig.visibleFields?.slug && (
                <TextInput
                  label="URL Slug"
                  placeholder="auto-generated-from-title"
                  required={mergedConfig.requiredFields?.slug}
                  value={formData.slug}
                  onChange={(e) => handleChange("slug", e.currentTarget.value)}
                  description="URL-friendly identifier for this meeting"
                />
              )}

              {mergedConfig.visibleFields?.description && (
                <Textarea
                  label="Description"
                  placeholder="Describe the meeting purpose and content"
                  minRows={3}
                  required={mergedConfig.requiredFields?.description}
                  value={formData.description}
                  onChange={(e) => handleChange("description", e.currentTarget.value)}
                />
              )}
            </Stack>
          </FormSection>
        )}

        {/* Schedule & Location */}
        {(mergedConfig.visibleFields?.scheduledAt ||
          mergedConfig.visibleFields?.durationMinutes ||
          mergedConfig.visibleFields?.location ||
          mergedConfig.visibleFields?.isOnline) && (
          <FormSection title="Schedule & Location" icon={<Calendar size={16} />}>
            <Stack gap="md">
              {mergedConfig.visibleFields?.scheduledAt && (
                <DateTimePicker
                  label="Scheduled Date & Time"
                  placeholder="Select date and time"
                  required={mergedConfig.requiredFields?.scheduledAt}
                  value={formData.scheduledAt}
                  onChange={(value) => handleChange("scheduledAt", value as Date | null)}
                />
              )}

              {mergedConfig.visibleFields?.durationMinutes && (
                <NumberInput
                  label="Duration (minutes)"
                  placeholder="60"
                  min={5}
                  value={formData.durationMinutes}
                  onChange={(value) => handleChange("durationMinutes", value || 60)}
                />
              )}

              {mergedConfig.visibleFields?.location && (
                <TextInput
                  label="Location"
                  placeholder="Room name, address, or 'Online'"
                  required={mergedConfig.requiredFields?.location}
                  value={formData.location}
                  onChange={(e) => handleChange("location", e.currentTarget.value)}
                />
              )}

              {mergedConfig.visibleFields?.isOnline && (
                <Checkbox
                  label="This is an online meeting"
                  checked={formData.isOnline}
                  onChange={(e) => handleChange("isOnline", e.currentTarget.checked)}
                />
              )}

              {mergedConfig.visibleFields?.meetingUrl && formData.isOnline && (
                <TextInput
                  label="Meeting URL"
                  placeholder="https://zoom.us/j/..."
                  required
                  value={formData.meetingUrl}
                  onChange={(e) => handleChange("meetingUrl", e.currentTarget.value)}
                />
              )}
            </Stack>
          </FormSection>
        )}

        {/* Organization & Settings */}
        {(mergedConfig.visibleFields?.orgId ||
          mergedConfig.visibleFields?.guideId ||
          mergedConfig.visibleFields?.visibility) && (
          <FormSection title="Organization & Settings" icon={<Settings size={16} />}>
            <Stack gap="md">
              {mergedConfig.visibleFields?.orgId && (
                <Select
                  label="Organization"
                  placeholder={hasOrgs ? "Select organization" : "No organizations"}
                  required={mergedConfig.requiredFields?.orgId}
                  data={mergedConfig.organizationOptions || []}
                  value={formData.orgId}
                  onChange={(value) => handleChange("orgId", value || "")}
                  disabled={!hasOrgs || Boolean(mergedConfig.fixedValues?.orgId)}
                />
              )}

              {mergedConfig.visibleFields?.guideId && (
                <TextInput
                  label="Guide/Facilitator ID"
                  placeholder="User ID of the guide"
                  required={mergedConfig.requiredFields?.guideId}
                  value={formData.guideId}
                  onChange={(e) => handleChange("guideId", e.currentTarget.value)}
                  description="Enter the guide's user ID (will be auto-filled from auth later)"
                  disabled={Boolean(mergedConfig.fixedValues?.guideId)}
                />
              )}

              {mergedConfig.visibleFields?.visibility && (
                <Select
                  label="Visibility"
                  placeholder="Select visibility"
                  data={VISIBILITY_OPTIONS}
                  value={formData.visibility}
                  onChange={(value) =>
                    handleChange("visibility", (value || "org") as any)
                  }
                />
              )}
            </Stack>
          </FormSection>
        )}

        {/* Internal Notes */}
        {mergedConfig.visibleFields?.notes && (
          <FormSection title="Internal Notes" icon={<FileText size={16} />}>
            <Textarea
              label="Notes"
              placeholder="Internal notes for guides and organizers"
              minRows={3}
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.currentTarget.value)}
              description="These notes are only visible to organizers"
            />
          </FormSection>
        )}

        {/* Media Attachments */}
        {mergedConfig.visibleFields?.media && (
          <FormSection title="Media Attachments (Optional)" icon={<ImageIcon size={16} />}>
            <MediaUpload
              files={formData.media}
              onChange={(files) => handleChange("media", files)}
              maxFiles={5}
              maxSize={100}
            />
          </FormSection>
        )}

        {/* Living Document */}
        {mergedConfig.visibleFields?.createDocument && (
          <FormSection title="Collaborative Document" icon={<FileText size={16} />}>
            <Checkbox
              label="Create a living document for this meeting"
              description="A collaborative markdown document will be created in Nextcloud that attendees can edit together"
              checked={formData.createDocument}
              onChange={(e) => handleChange("createDocument", e.currentTarget.checked)}
            />
          </FormSection>
        )}

        {/* Nextcloud Integration */}
        {(mergedConfig.visibleFields?.syncToCalendar ||
          mergedConfig.visibleFields?.createTalkRoom) && (
          <FormSection title="Nextcloud Integration" icon={<Calendar size={16} />}>
            <Stack gap="md">
              {mergedConfig.visibleFields?.syncToCalendar && (
                <Checkbox
                  label="Sync to Nextcloud Calendar"
                  description="Event will appear in Nextcloud Calendar and mobile calendar apps (CalDAV)"
                  checked={formData.syncToCalendar}
                  onChange={(e) => handleChange("syncToCalendar", e.currentTarget.checked)}
                />
              )}

              {mergedConfig.visibleFields?.createTalkRoom && formData.isOnline && (
                <Checkbox
                  label="Create video chat room (Nextcloud Talk)"
                  description="Auto-generate a Nextcloud Talk room for online meetings"
                  checked={formData.createTalkRoom}
                  onChange={(e) => handleChange("createTalkRoom", e.currentTarget.checked)}
                />
              )}
            </Stack>
          </FormSection>
        )}

        {error && (
          <Text c="red" size="sm">
            {error}
          </Text>
        )}

        <Group justify="flex-end">
          <Button type="submit" loading={isSubmitting} disabled={!isFormValid}>
            {submitButtonText}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

interface FormSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function FormSection({ title, icon, children }: FormSectionProps) {
  return (
    <Paper withBorder radius="md" p="lg">
      <Stack gap="md">
        <Group gap="xs">
          <ThemeIcon variant="light" size="sm">
            {icon}
          </ThemeIcon>
          <Text fw={600}>{title}</Text>
        </Group>
        <Divider />
        <Box>{children}</Box>
      </Stack>
    </Paper>
  );
}
