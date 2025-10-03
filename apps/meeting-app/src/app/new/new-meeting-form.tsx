"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  Group,
  NumberInput,
  Paper,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
} from "@mantine/core";
import { DateInput, TimeInput } from "@mantine/dates";
import dayjs from "dayjs";
import { Calendar, Image, Plus, Settings, Trash } from "lucide-react";

import { createMeetingAction } from "@/lib/actions";
import type { MeetingVisibility, Organization } from "@elkdonis/types";

interface MeetingFormData {
  title: string;
  description: string;
  startDate: Date | null;
  startTime: string;
  endTime: string;
  location: string;
  isVirtual: boolean;
  meetingUrl: string;
  orgId: string;
  maxAttendees: number | undefined;
  isMaxAttendeesUnlimited: boolean;
  rsvpDeadline: Date | null;
  isPublic: boolean;
  requireRSVP: boolean;
  tags: string[];
  meetingImageUrl: string;
  notes: string;
}

interface NewMeetingFormProps {
  organizations: Organization[];
}

const defaultTime = "09:00";

const buildInitialState = (organizations: Organization[]): MeetingFormData => ({
  title: "",
  description: "",
  startDate: null,
  startTime: defaultTime,
  endTime: "",
  location: "",
  isVirtual: false,
  meetingUrl: "",
  orgId: organizations[0]?.id ?? "",
  maxAttendees: undefined,
  isMaxAttendeesUnlimited: true,
  rsvpDeadline: null,
  isPublic: true,
  requireRSVP: true,
  tags: [],
  meetingImageUrl: "",
  notes: "",
});

export function NewMeetingForm({ organizations }: NewMeetingFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<MeetingFormData>(() =>
    buildInitialState(organizations),
  );
  const [tagDraft, setTagDraft] = useState("");
  const hasOrganizations = organizations.length > 0;

  const organizationOptions = useMemo(
    () => organizations.map(org => ({ value: org.id, label: org.name })),
    [organizations],
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isFormValid = useMemo(() => {
    return Boolean(
      hasOrganizations &&
        formData.title.trim() &&
        formData.startDate &&
        formData.startTime &&
        formData.location.trim() &&
        formData.orgId,
    );
  }, [formData, hasOrganizations]);

  const handleFieldChange = <Key extends keyof MeetingFormData>(
    field: Key,
    value: MeetingFormData[Key],
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const normalizeDateValue = (value: unknown): Date | null => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value as string);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const addTag = () => {
    const trimmed = tagDraft.trim();
    if (!trimmed) return;
    if (formData.tags.includes(trimmed)) {
      setTagDraft("");
      return;
    }
    setFormData(prev => ({ ...prev, tags: [...prev.tags, trimmed] }));
    setTagDraft("");
  };

  const removeTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(item => item !== tag),
    }));
  };

  const combineDateTime = (date: Date | null, time: string) => {
    if (!date || !time) return null;
    const [hours, minutes] = time.split(":");
    const combined = dayjs(date)
      .set("hour", Number(hours))
      .set("minute", Number(minutes))
      .set("second", 0)
      .set("millisecond", 0);
    return combined.toDate();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!isFormValid) {
      setError("Please complete the required fields before submitting.");
      return;
    }

    const start = combineDateTime(formData.startDate, formData.startTime);
    if (!start) {
      setError("A valid meeting date and start time are required.");
      return;
    }

    let end: Date | null = null;
    if (formData.endTime) {
      end = combineDateTime(formData.startDate, formData.endTime);
      if (!end) {
        setError("Please provide a valid end time or leave it blank.");
        return;
      }
      if (end <= start) {
        setError("End time must be after the start time.");
        return;
      }
    }

    if (formData.isVirtual && !formData.meetingUrl.trim()) {
      setError("Provide a meeting URL when the event is virtual.");
      return;
    }

    const rsvpDeadlineDate = normalizeDateValue(formData.rsvpDeadline);

    setIsSubmitting(true);

    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const visibility: MeetingVisibility = formData.isPublic
        ? "PUBLIC"
        : "INVITE_ONLY";

      const attachments = [] as string[];
      if (formData.meetingImageUrl.trim()) {
        attachments.push(formData.meetingImageUrl.trim());
      }

      await createMeetingAction({
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        startTime: start.toISOString(),
        endTime: end ? end.toISOString() : undefined,
        orgId: formData.orgId,
        videoLink: formData.isVirtual ? formData.meetingUrl.trim() : undefined,
        isRSVPEnabled: formData.requireRSVP,
        location: formData.location.trim(),
        timeZone: timezone,
        recurrencePattern: "NONE",
        recurrenceCustomRule: undefined,
        reminderMinutesBefore: undefined,
        coHosts: [],
        rsvpDeadline: rsvpDeadlineDate ? rsvpDeadlineDate.toISOString() : undefined,
        visibility,
        autoRecord: false,
        tags: formData.tags,
        attachments,
        followUpWorkflow: false,
      });

      setSuccessMessage("Meeting created successfully.");
      setFormData(buildInitialState(organizations));
      setTagDraft("");
      router.push("/");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to create the meeting right now.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="lg">
        <Section title="Basic information" icon={<Calendar size={14} />}>
          <Stack gap="md">
            <TextInput
              label="Meeting title"
              required
              placeholder="Enter meeting title"
              value={formData.title}
              onChange={event => handleFieldChange("title", event.currentTarget.value)}
            />
            <Textarea
              label="Description"
              placeholder="Describe the meeting purpose and agenda"
              minRows={3}
              autosize
              value={formData.description}
              onChange={event =>
                handleFieldChange("description", event.currentTarget.value)
              }
            />
            <Group align="flex-start" grow>
              <DateInput
                label="Date"
                placeholder="yyyy-mm-dd"
                value={formData.startDate}
                onChange={value => handleFieldChange("startDate", normalizeDateValue(value))}
                required
              />
              <TimeInput
                label="Start time"
                value={formData.startTime}
                onChange={event =>
                  handleFieldChange("startTime", event.currentTarget.value)
                }
                required
              />
              <TimeInput
                label="End time"
                value={formData.endTime}
                onChange={event =>
                  handleFieldChange("endTime", event.currentTarget.value)
                }
              />
            </Group>
            <TextInput
              label="Location"
              placeholder="Meeting room, address, or 'Virtual'"
              required
              value={formData.location}
              onChange={event => handleFieldChange("location", event.currentTarget.value)}
            />
            <Checkbox
              label="Virtual meeting"
              checked={formData.isVirtual}
              onChange={event => handleFieldChange("isVirtual", event.currentTarget.checked)}
            />
            {formData.isVirtual ? (
              <TextInput
                label="Meeting URL"
                placeholder="https://zoom.us/j/..."
                value={formData.meetingUrl}
                onChange={event =>
                  handleFieldChange("meetingUrl", event.currentTarget.value)
                }
                required
              />
            ) : null}
          </Stack>
        </Section>

        <Section title="Organization & settings" icon={<Settings size={14} />}>
          <Stack gap="md">
            <Select
              label="Organization"
              placeholder={hasOrganizations ? "Select organization" : "No organizations available"}
              data={organizationOptions}
              value={formData.orgId || null}
              onChange={value => handleFieldChange("orgId", value ?? "")}
              disabled={!hasOrganizations}
            />
            {!hasOrganizations ? (
              <Text size="sm" c="dimmed">
                Create an organization to schedule meetings.
              </Text>
            ) : null}

            <Group align="flex-end" gap="md">
              <NumberInput
                label="Max attendees"
                placeholder="No limit"
                value={formData.isMaxAttendeesUnlimited ? undefined : formData.maxAttendees}
                onChange={value =>
                  handleFieldChange(
                    "maxAttendees",
                    typeof value === "number" ? value : undefined,
                  )
                }
                min={1}
                disabled={formData.isMaxAttendeesUnlimited}
              />
              <Checkbox
                label="No limit"
                checked={formData.isMaxAttendeesUnlimited}
                onChange={event => {
                  const checked = event.currentTarget.checked;
                  handleFieldChange("isMaxAttendeesUnlimited", checked);
                  if (checked) {
                    handleFieldChange("maxAttendees", undefined);
                  }
                }}
              />
            </Group>

            <DateInput
              label="RSVP deadline"
              placeholder="yyyy-mm-dd"
              value={formData.rsvpDeadline}
              onChange={value => handleFieldChange("rsvpDeadline", normalizeDateValue(value))}
            />

            <Checkbox
              label="Public meeting (visible to all users)"
              checked={formData.isPublic}
              onChange={event => handleFieldChange("isPublic", event.currentTarget.checked)}
            />

            <Checkbox
              label="Require RSVP"
              checked={formData.requireRSVP}
              onChange={event => handleFieldChange("requireRSVP", event.currentTarget.checked)}
            />
          </Stack>
        </Section>

        <Section title="Tags & media" icon={<Image size={14} />}>
          <Stack gap="md">
            <Group gap="sm" align="flex-end">
              <TextInput
                label="Add a tag"
                placeholder="Tag name"
                value={tagDraft}
                onChange={event => setTagDraft(event.currentTarget.value)}
              />
              <Button onClick={addTag} variant="outline" disabled={!tagDraft.trim()}>
                Add
              </Button>
            </Group>
            {formData.tags.length > 0 ? (
              <Group gap="xs">
                {formData.tags.map(tag => (
                  <Badge
                    key={tag}
                    rightSection={
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="gray"
                        aria-label={`Remove ${tag}`}
                        onClick={() => removeTag(tag)}
                      >
                        <Trash size={14} />
                      </ActionIcon>
                    }
                  >
                    {tag}
                  </Badge>
                ))}
              </Group>
            ) : null}

            <TextInput
              label="Meeting image URL"
              placeholder="https://example.com/image.jpg"
              value={formData.meetingImageUrl}
              onChange={event =>
                handleFieldChange("meetingImageUrl", event.currentTarget.value)
              }
            />

            <Textarea
              label="Internal notes"
              placeholder="Internal notes for organizers"
              autosize
              minRows={3}
              value={formData.notes}
              onChange={event => handleFieldChange("notes", event.currentTarget.value)}
            />
          </Stack>
        </Section>

        {error ? (
          <Text c="red" size="sm">
            {error}
          </Text>
        ) : null}
        {successMessage ? (
          <Text c="green" size="sm">
            {successMessage}
          </Text>
        ) : null}

        <Group justify="flex-end">
          <Button
            type="submit"
            loading={isSubmitting}
            disabled={!isFormValid || !hasOrganizations}
            leftSection={<Plus size={16} />}
          >
            Create meeting
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

interface SectionProps {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}

function Section({ title, icon, children }: SectionProps) {
  return (
    <Paper withBorder radius="md" p="lg">
      <Stack gap="sm">
        <Group gap="xs">
          <ThemeIcon variant="light" color="blue" size="sm">
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









