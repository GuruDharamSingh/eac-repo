"use client";

import { useState } from "react";
import {
  Button,
  Checkbox,
  Collapse,
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
  UnstyledButton,
  ActionIcon,
  Table,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { Calendar, Settings, FileText, Image as ImageIcon, Users, ChevronDown, Repeat, LayoutGrid, Plus, Trash2 } from "lucide-react";
import { useMeetingForm, type MeetingFormData, type MeetingFormConfig } from "@elkdonis/hooks";
import { VISIBILITY_OPTIONS } from "@elkdonis/utils";
import { MediaUpload } from "./MediaUpload";
import { RichTextEditor } from "./RichTextEditor";

export { type MeetingFormData, type MeetingFormConfig } from "@elkdonis/hooks";

export interface MeetingFormProps {
  config?: MeetingFormConfig;
  onSubmit: (data: MeetingFormData) => Promise<void>;
  onSuccess?: () => void;
  submitButtonText?: string;
  /** Enable the Nextcloud file library tab in media uploads */
  enableLibrary?: boolean;
  /** Organization ID for the file library browser */
  orgId?: string;
}

export function MeetingForm({
  config = {},
  onSubmit,
  onSuccess,
  submitButtonText = "Create Meeting",
  enableLibrary = false,
  orgId,
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

  const [advancedOpen, setAdvancedOpen] = useState(false);

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
                <Stack gap={4}>
                  <Text size="sm" fw={500}>
                    Description{" "}
                    {mergedConfig.requiredFields?.description && (
                      <Text component="span" c="red" size="sm">*</Text>
                    )}
                  </Text>
                  <RichTextEditor
                    content={formData.description}
                    onChange={(html) => handleChange("description", html)}
                    placeholder="Describe the meeting purpose and content"
                    minimal
                  />
                </Stack>
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
                  onChange={(value) => handleChange("scheduledAt", value ? new Date(value) : null)}
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

        {/* RSVP & Attendance */}
        {mergedConfig.visibleFields?.isRSVPEnabled && (
          <FormSection title="RSVP & Attendance" icon={<Users size={16} />}>
            <Stack gap="md">
              <Checkbox
                label="Enable RSVP for this meeting"
                description="Allow attendees to register and display attendance count on the meeting card"
                checked={formData.isRSVPEnabled}
                onChange={(e) => handleChange("isRSVPEnabled", e.currentTarget.checked)}
              />
              {formData.isRSVPEnabled && (
                <>
                  {mergedConfig.visibleFields?.rsvpDeadline && (
                    <DateTimePicker
                      label="RSVP Deadline"
                      placeholder="Optional: Set a deadline for RSVPs"
                      description="After this date, users won't be able to RSVP"
                      value={formData.rsvpDeadline}
                      onChange={(value) => handleChange("rsvpDeadline", value ? new Date(value) : null)}
                      clearable
                    />
                  )}
                  {mergedConfig.visibleFields?.minAttendees && (
                    <NumberInput
                      label="Minimum Attendees"
                      placeholder="Optional: Set minimum required attendees"
                      description="Meeting requires at least this many attendees to proceed"
                      min={1}
                      value={formData.minAttendees as number}
                      onChange={(value) => handleChange("minAttendees", value || "")}
                    />
                  )}
                  {mergedConfig.visibleFields?.notifyOnMinAttendees && formData.minAttendees && (
                    <Checkbox
                      label="Notify when minimum attendees reached"
                      description="Send notification to the meeting organizer when the minimum attendee count is met"
                      checked={formData.notifyOnMinAttendees}
                      onChange={(e) => handleChange("notifyOnMinAttendees", e.currentTarget.checked)}
                    />
                  )}
                </>
              )}
            </Stack>
          </FormSection>
        )}

        {/* Recurrence */}
        {mergedConfig.visibleFields?.recurrencePattern && (
          <FormSection title="Recurrence" icon={<Repeat size={16} />}>
            <Stack gap="md">
              <Select
                label="Repeat"
                description="Set this meeting to repeat on a schedule"
                data={[
                  { value: "NONE", label: "Does not repeat" },
                  { value: "DAILY", label: "Daily" },
                  { value: "WEEKLY", label: "Weekly" },
                  { value: "MONTHLY", label: "Monthly" },
                  { value: "CUSTOM", label: "Custom..." },
                ]}
                value={formData.recurrencePattern}
                onChange={(value) =>
                  handleChange("recurrencePattern", (value || "NONE") as any)
                }
              />
              {formData.recurrencePattern === "CUSTOM" &&
                mergedConfig.visibleFields?.recurrenceCustomRule && (
                  <TextInput
                    label="Custom Recurrence Rule"
                    placeholder='e.g. "Every 2 weeks on Tuesday and Thursday"'
                    description="Describe the custom schedule for this meeting"
                    value={formData.recurrenceCustomRule}
                    onChange={(e) =>
                      handleChange("recurrenceCustomRule", e.currentTarget.value)
                    }
                  />
                )}
              {formData.recurrencePattern !== "NONE" &&
                mergedConfig.visibleFields?.recurrenceUntil && (
                  <DateTimePicker
                    label="Recurrence End Date"
                    placeholder="Optional: When should this recurring meeting stop?"
                    description="Leave empty for indefinite recurrence"
                    value={formData.recurrenceUntil}
                    onChange={(value) =>
                      handleChange("recurrenceUntil", value ? new Date(value) : null)
                    }
                    clearable
                  />
                )}
            </Stack>
          </FormSection>
        )}

        {/* Event Page */}
        {mergedConfig.visibleFields?.createEventPage && (
          <FormSection title="Event Page" icon={<LayoutGrid size={16} />}>
            <Stack gap="md">
              <Checkbox
                label="Create an event page for this meeting"
                description="A rich detail page with custom colors, content editor, and data tables"
                checked={formData.createEventPage}
                onChange={(e) => handleChange("createEventPage", e.currentTarget.checked)}
              />

              {/* Inline Table Builder - shown when event page is enabled */}
              {formData.createEventPage && mergedConfig.visibleFields?.eventPageTableData && (
                <Paper withBorder radius="md" p="md" bg="gray.0">
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Text size="sm" fw={600}>Event Details Table (Optional)</Text>
                      <Group gap={4}>
                        <Button
                          size="xs"
                          variant="light"
                          leftSection={<Plus size={12} />}
                          onClick={() => {
                            const prev = formData.eventPageTableData;
                            handleChange("eventPageTableData", {
                              columns: [...prev.columns, `Column ${prev.columns.length + 1}`],
                              rows: prev.rows.map((row: string[]) => [...row, ""]),
                            });
                          }}
                        >
                          Column
                        </Button>
                        <Button
                          size="xs"
                          variant="light"
                          leftSection={<Plus size={12} />}
                          onClick={() => {
                            const prev = formData.eventPageTableData;
                            handleChange("eventPageTableData", {
                              ...prev,
                              rows: [...prev.rows, prev.columns.map(() => "")],
                            });
                          }}
                          disabled={formData.eventPageTableData.columns.length === 0}
                        >
                          Row
                        </Button>
                      </Group>
                    </Group>
                    <Text size="xs" c="dimmed">
                      Add a data table to show structured info like schedule, topics, speakers, etc. You can edit it later on the event page.
                    </Text>

                    {formData.eventPageTableData.columns.length > 0 ? (
                      <Table withTableBorder withColumnBorders>
                        <Table.Thead>
                          <Table.Tr>
                            {formData.eventPageTableData.columns.map((col: string, ci: number) => (
                              <Table.Th key={ci}>
                                <Group gap="xs" wrap="nowrap">
                                  <TextInput
                                    size="xs"
                                    value={col}
                                    onChange={(e) => {
                                      const prev = formData.eventPageTableData;
                                      handleChange("eventPageTableData", {
                                        ...prev,
                                        columns: prev.columns.map((c: string, i: number) => i === ci ? e.currentTarget.value : c),
                                      });
                                    }}
                                    style={{ flex: 1 }}
                                    variant="unstyled"
                                    fw={600}
                                    placeholder="Column name"
                                  />
                                  <ActionIcon
                                    size="xs"
                                    variant="subtle"
                                    color="red"
                                    onClick={() => {
                                      const prev = formData.eventPageTableData;
                                      handleChange("eventPageTableData", {
                                        columns: prev.columns.filter((_: string, i: number) => i !== ci),
                                        rows: prev.rows.map((row: string[]) => row.filter((_: string, i: number) => i !== ci)),
                                      });
                                    }}
                                  >
                                    <Trash2 size={10} />
                                  </ActionIcon>
                                </Group>
                              </Table.Th>
                            ))}
                            <Table.Th w={32} />
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {formData.eventPageTableData.rows.map((row: string[], ri: number) => (
                            <Table.Tr key={ri}>
                              {row.map((cell: string, ci: number) => (
                                <Table.Td key={ci}>
                                  <TextInput
                                    size="xs"
                                    value={cell}
                                    onChange={(e) => {
                                      const prev = formData.eventPageTableData;
                                      handleChange("eventPageTableData", {
                                        ...prev,
                                        rows: prev.rows.map((r: string[], rIdx: number) =>
                                          rIdx === ri
                                            ? r.map((c: string, cIdx: number) => cIdx === ci ? e.currentTarget.value : c)
                                            : r
                                        ),
                                      });
                                    }}
                                    variant="unstyled"
                                    placeholder="..."
                                  />
                                </Table.Td>
                              ))}
                              <Table.Td>
                                <ActionIcon
                                  size="xs"
                                  variant="subtle"
                                  color="red"
                                  onClick={() => {
                                    const prev = formData.eventPageTableData;
                                    handleChange("eventPageTableData", {
                                      ...prev,
                                      rows: prev.rows.filter((_: string[], i: number) => i !== ri),
                                    });
                                  }}
                                >
                                  <Trash2 size={10} />
                                </ActionIcon>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    ) : (
                      <Text size="xs" c="dimmed" ta="center" py="xs">
                        Click "Column" to start building a table.
                      </Text>
                    )}
                  </Stack>
                </Paper>
              )}
            </Stack>
          </FormSection>
        )}

        {/* Advanced Options (Collapsible) */}
        {(mergedConfig.visibleFields?.orgId ||
          mergedConfig.visibleFields?.guideId ||
          mergedConfig.visibleFields?.visibility ||
          mergedConfig.visibleFields?.notes) && (
          <Paper withBorder radius="md" p="lg">
            <Stack gap="md">
              <UnstyledButton
                onClick={() => setAdvancedOpen((o) => !o)}
                style={{ width: "100%" }}
              >
                <Group justify="space-between">
                  <Group gap="xs">
                    <ThemeIcon variant="light" size="sm">
                      <Settings size={16} />
                    </ThemeIcon>
                    <Text fw={600}>Advanced Options</Text>
                  </Group>
                  <ThemeIcon variant="subtle" size="sm">
                    <ChevronDown
                      size={16}
                      style={{
                        transform: advancedOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 200ms ease",
                      }}
                    />
                  </ThemeIcon>
                </Group>
              </UnstyledButton>

              <Collapse in={advancedOpen}>
                <Stack gap="lg" pt="md">
                  {/* Organization & Settings */}
                  {(mergedConfig.visibleFields?.orgId ||
                    mergedConfig.visibleFields?.guideId ||
                    mergedConfig.visibleFields?.visibility) && (
                    <>
                      <Divider label="Organization & Settings" labelPosition="left" />
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
                    </>
                  )}

                  {/* Internal Notes */}
                  {mergedConfig.visibleFields?.notes && (
                    <>
                      <Divider label="Internal Notes" labelPosition="left" />
                      <Textarea
                        label="Notes"
                        placeholder="Internal notes for guides and organizers"
                        minRows={3}
                        value={formData.notes}
                        onChange={(e) => handleChange("notes", e.currentTarget.value)}
                        description="These notes are only visible to organizers"
                      />
                    </>
                  )}
                </Stack>
              </Collapse>
            </Stack>
          </Paper>
        )}

        {/* Media Attachments */}
        {mergedConfig.visibleFields?.media && (
          <FormSection title="Media Attachments (Optional)" icon={<ImageIcon size={16} />}>
            <MediaUpload
              files={formData.media}
              onChange={(files) => handleChange("media", files)}
              maxFiles={5}
              maxSize={100}
              enableLibrary={enableLibrary}
              orgId={orgId}
              selectedFiles={formData.selectedFiles}
              onSelectFile={(file) =>
                handleChange("selectedFiles", [...formData.selectedFiles, file])
              }
              onRemoveSelectedFile={(index) =>
                handleChange(
                  "selectedFiles",
                  formData.selectedFiles.filter((_, i) => i !== index)
                )
              }
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

              {mergedConfig.visibleFields?.createTalkRoom && (
                <Checkbox
                  label="Create video chat room (Nextcloud Talk)"
                  description="Create a Nextcloud Talk room for this meeting"
                  checked={formData.createTalkRoom}
                  onChange={(e) => handleChange("createTalkRoom", e.currentTarget.checked)}
                />
              )}

              {mergedConfig.visibleFields?.showInLiveFeed && (
                <Checkbox
                  label="Show in Live Video Feed"
                  description="Display this meeting on the public /live page with countdown and video player"
                  checked={formData.showInLiveFeed}
                  onChange={(e) => handleChange("showInLiveFeed", e.currentTarget.checked)}
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
