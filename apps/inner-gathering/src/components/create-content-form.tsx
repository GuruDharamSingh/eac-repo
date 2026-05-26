"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ActionIcon,
  Box,
  Button,
  Checkbox,
  Collapse,
  Group,
  Loader,
  NumberInput,
  Paper,
  PasswordInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import {
  Calendar,
  ChevronRight,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  LayoutGrid,
  Lock,
  MessageCircle,
  Plus,
  Repeat,
  Save,
  Send,
  Settings,
  ShieldCheck,
  Trash2,
  Users,
  Video,
} from "lucide-react";
import { MediaUpload, RichTextEditor } from "@elkdonis/ui";
import { VISIBILITY_OPTIONS, slugify, DEFAULT_MEETING_DURATION } from "@elkdonis/utils";
import { createMeetingAction, createPostAction } from "@/lib/actions";
import { saveDraftAction, loadDraftsAction, deleteDraftAction, type DraftData, type SavedDraft } from "@/lib/draft-actions";
import { getSession } from "@elkdonis/auth-client";

type ContentType = "post" | "meeting";

interface CreateContentFormProps {
  defaultType?: ContentType;
  onSuccess?: () => void;
}

const ORGANIZATION_OPTIONS = [
  { value: "inner_group", label: "InnerGathering" },
  { value: "elkdonis", label: "Elkdonis Arts Collective" },
  { value: "sunjay", label: "Sunjay's Teaching Circle" },
  { value: "guru-dharam", label: "Guru Dharam's Practice Group" },
];

export function CreateContentForm({
  defaultType = "post",
  onSuccess,
}: CreateContentFormProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [contentType, setContentType] = useState<ContentType>(defaultType);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Collapsible sections
  const [showSchedule, setShowSchedule] = useState(true);
  const [showRsvp, setShowRsvp] = useState(false);
  const [showRecurrence, setShowRecurrence] = useState(false);
  const [showEventPage, setShowEventPage] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Draft state
  const [draftId, setDraftId] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [drafts, setDrafts] = useState<SavedDraft[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);

  // Blog password gating
  const [orgAccessStatus, setOrgAccessStatus] = useState<{
    needsPassword: boolean;
    isOwnerOrGuide: boolean;
    hasPassword: boolean;
    loading: boolean;
  }>({ needsPassword: false, isOwnerOrGuide: true, hasPassword: false, loading: false });
  const [blogPassword, setBlogPassword] = useState("");
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [verifyingPassword, setVerifyingPassword] = useState(false);

  // Shared fields
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [body, setBody] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [visibility, setVisibility] = useState<string>("PUBLIC");
  const [orgId, setOrgId] = useState("inner_group");
  const [media, setMedia] = useState<File[]>([]);
  const [createDocument, setCreateDocument] = useState(false);
  const [createTalkRoom, setCreateTalkRoom] = useState(false);

  // Meeting-specific fields
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number | string>(
    DEFAULT_MEETING_DURATION ?? 60,
  );
  const [location, setLocation] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState("");
  const [syncToCalendar, setSyncToCalendar] = useState(true);
  const [isRSVPEnabled, setIsRSVPEnabled] = useState(false);
  const [rsvpDeadline, setRsvpDeadline] = useState<Date | null>(null);
  const [minAttendees, setMinAttendees] = useState<number | string>("");
  const [notifyOnMinAttendees, setNotifyOnMinAttendees] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState("NONE");
  const [recurrenceCustomRule, setRecurrenceCustomRule] = useState("");
  const [recurrenceUntil, setRecurrenceUntil] = useState<Date | null>(null);
  const [createEventPage, setCreateEventPage] = useState(false);
  const [eventPageTableData, setEventPageTableData] = useState<{
    columns: string[];
    rows: string[][];
  }>({ columns: [], rows: [] });
  const [notes, setNotes] = useState("");
  const [guideId, setGuideId] = useState("");

  // Auth
  useEffect(() => {
    const fetchUserId = async () => {
      try {
        const { user } = await getSession();
        if (user) setUserId(user.id);
      } catch (err) {
        console.error("Error fetching user ID:", err);
      }
    };
    fetchUserId();
  }, []);

  useEffect(() => {
    setSlug(slugify(title));
  }, [title]);

  // Check org access when org changes
  useEffect(() => {
    if (!userId) return;
    const checkOrgAccess = async () => {
      setOrgAccessStatus((prev) => ({ ...prev, loading: true }));
      setBlogPassword("");
      setPasswordVerified(false);
      setPasswordError(null);
      try {
        const res = await fetch(`/api/org/${orgId}/blog-password`);
        if (res.ok) {
          const data = await res.json();
          setOrgAccessStatus({ needsPassword: data.needsPassword, isOwnerOrGuide: data.isOwnerOrGuide, hasPassword: data.hasPassword, loading: false });
        } else {
          setOrgAccessStatus({ needsPassword: false, isOwnerOrGuide: false, hasPassword: false, loading: false });
        }
      } catch {
        setOrgAccessStatus({ needsPassword: false, isOwnerOrGuide: false, hasPassword: false, loading: false });
      }
    };
    checkOrgAccess();
  }, [orgId, userId]);

  // Load drafts
  useEffect(() => {
    if (!userId) return;
    loadDraftsAction(userId).then(setDrafts).catch(() => {});
  }, [userId]);

  const handleVerifyPassword = useCallback(async () => {
    if (!blogPassword.trim()) { setPasswordError("Enter the blog password"); return; }
    setVerifyingPassword(true);
    setPasswordError(null);
    try {
      const res = await fetch(`/api/org/${orgId}/blog-password/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: blogPassword }),
      });
      const data = await res.json();
      if (data.valid) { setPasswordVerified(true); setPasswordError(null); }
      else { setPasswordError("Incorrect password"); }
    } catch { setPasswordError("Failed to verify"); }
    finally { setVerifyingPassword(false); }
  }, [blogPassword, orgId]);

  const orgAccessGranted = orgAccessStatus.isOwnerOrGuide || !orgAccessStatus.hasPassword || passwordVerified;

  const isFormValid =
    title.trim().length > 0 &&
    orgAccessGranted &&
    (contentType === "post" ? body.trim().length > 0 : scheduledAt !== null);

  // Draft helpers
  const collectDraftData = useCallback((): DraftData => ({
    id: draftId ?? undefined,
    contentType, orgId, title, slug, body, excerpt, visibility,
    meetingData: {
      scheduledAt: scheduledAt?.toISOString() ?? null,
      durationMinutes, location, isOnline, meetingUrl, syncToCalendar,
      isRSVPEnabled, rsvpDeadline: rsvpDeadline?.toISOString() ?? null,
      minAttendees, notifyOnMinAttendees, recurrencePattern, recurrenceCustomRule,
      recurrenceUntil: recurrenceUntil?.toISOString() ?? null,
      createEventPage, eventPageTableData, notes, guideId,
    },
    mediaRefs: [],
    integrationSettings: { createDocument, createTalkRoom, syncToCalendar },
    currentStep: 0,
  }), [contentType, orgId, title, slug, body, excerpt, visibility, scheduledAt, durationMinutes, location, isOnline, meetingUrl, syncToCalendar, isRSVPEnabled, rsvpDeadline, minAttendees, notifyOnMinAttendees, recurrencePattern, recurrenceCustomRule, recurrenceUntil, createEventPage, eventPageTableData, notes, guideId, createDocument, createTalkRoom, draftId]);

  const handleSaveDraft = useCallback(async () => {
    if (!userId) return;
    setSavingDraft(true);
    setDraftSaved(false);
    try {
      const data = collectDraftData();
      const result = await saveDraftAction(userId, data);
      setDraftId(result.draftId);
      setDraftSaved(true);
      const updated = await loadDraftsAction(userId);
      setDrafts(updated);
      setTimeout(() => setDraftSaved(false), 2000);
    } catch { setError("Failed to save draft"); }
    finally { setSavingDraft(false); }
  }, [userId, collectDraftData]);

  const handleLoadDraft = useCallback((draft: SavedDraft) => {
    setContentType(draft.contentType);
    setOrgId(draft.orgId);
    setTitle(draft.title);
    setSlug(draft.slug);
    setBody(draft.body);
    setExcerpt(draft.excerpt);
    setVisibility(draft.visibility);
    setDraftId(draft.id);
    const md = draft.meetingData || {};
    if (md.scheduledAt) setScheduledAt(new Date(md.scheduledAt as string));
    if (md.durationMinutes) setDurationMinutes(md.durationMinutes as number);
    if (md.location) setLocation(md.location as string);
    if (md.isOnline !== undefined) setIsOnline(md.isOnline as boolean);
    if (md.meetingUrl) setMeetingUrl(md.meetingUrl as string);
    if (md.isRSVPEnabled !== undefined) setIsRSVPEnabled(md.isRSVPEnabled as boolean);
    if (md.recurrencePattern) setRecurrencePattern(md.recurrencePattern as string);
    if (md.createEventPage !== undefined) setCreateEventPage(md.createEventPage as boolean);
    if (md.notes) setNotes(md.notes as string);
    if (md.guideId) setGuideId(md.guideId as string);
    const is = draft.integrationSettings || {};
    if (is.createDocument !== undefined) setCreateDocument(is.createDocument as boolean);
    if (is.createTalkRoom !== undefined) setCreateTalkRoom(is.createTalkRoom as boolean);
    setShowDrafts(false);
  }, []);

  const handleDeleteDraft = useCallback(async (id: string) => {
    if (!userId) return;
    await deleteDraftAction(userId, id);
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    if (draftId === id) setDraftId(null);
  }, [userId, draftId]);

  // Media upload
  const uploadMedia = async (files: File[]) => {
    if (!userId || files.length === 0) return [];
    const uploaded: Array<{ fileId: string; path: string; url: string; filename: string; mimeType: string; size: number; type: "image" | "video" | "audio" | "document" }> = [];
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("userId", userId);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Failed to upload media");
      const json = await res.json();
      if (!json?.success || !json?.fileId || !json?.path || !json?.url || !json?.mediaType)
        throw new Error("Invalid response from upload service");
      uploaded.push({ fileId: json.fileId, path: json.path, url: json.url, filename: json.filename, mimeType: json.mimeType, size: json.size, type: json.mediaType });
    }
    return uploaded;
  };

  const createCollaborativeDocument = async (meetingTitle: string) => {
    const docResponse = await fetch("/api/create-document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, meetingTitle: meetingTitle.trim(), meetingId: `temp-${Date.now()}` }),
    });
    if (docResponse.ok) {
      const docJson = await docResponse.json();
      if (docJson?.success && docJson?.fileId && docJson?.url)
        return { fileId: docJson.fileId, url: docJson.url };
    }
    return undefined;
  };

  // Submit
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!userId) { setError("You must be logged in"); return; }
    if (!isFormValid) { setError("Please fill in all required fields"); return; }
    setIsSubmitting(true);

    try {
      const uploadedMedia = await uploadMedia(media);

      if (contentType === "meeting") {
        let documentData: { fileId: string; url: string } | undefined;
        if (createDocument) documentData = await createCollaborativeDocument(title);

        await createMeetingAction({
          userId, title: title.trim(), scheduledAt: scheduledAt!,
          durationMinutes: typeof durationMinutes === "string" ? parseInt(durationMinutes, 10) : durationMinutes,
          location: location.trim() || undefined, description: body.trim() || undefined,
          visibility: visibility as any, isOnline, meetingUrl: meetingUrl.trim() || undefined,
          media: uploadedMedia.length > 0 ? uploadedMedia : undefined,
          nextcloudDocumentId: documentData?.fileId, documentUrl: documentData?.url,
          syncToCalendar, createTalkRoom: createTalkRoom || isOnline, isRSVPEnabled,
          rsvpDeadline: rsvpDeadline || undefined,
          minAttendees: minAttendees ? Number(minAttendees) : undefined, notifyOnMinAttendees,
          recurrencePattern: recurrencePattern !== "NONE" ? (recurrencePattern as any) : undefined,
          recurrenceCustomRule: recurrenceCustomRule.trim() || undefined,
          recurrenceUntil: recurrenceUntil || undefined, createEventPage,
          eventPageTableData: createEventPage && eventPageTableData.columns.length > 0 ? eventPageTableData : undefined,
          blogPassword: blogPassword || undefined,
        });
      } else {
        let documentUrl: string | undefined;
        if (createDocument) {
          const docRes = await fetch("/api/create-document", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orgId, meetingTitle: title.trim(), meetingId: `post-${Date.now()}` }),
          });
          if (docRes.ok) {
            const docJson = await docRes.json();
            if (docJson?.success && docJson?.url) documentUrl = docJson.url;
          }
        }

        await createPostAction({
          userId, title: title.trim(), body: body.trim(),
          excerpt: excerpt.trim() || undefined, visibility,
          media: uploadedMedia.length > 0 ? uploadedMedia : undefined,
          documentUrl, createTalkRoom, orgId, blogPassword: blogPassword || undefined,
        });
      }

      if (draftId && userId) deleteDraftAction(userId, draftId).catch(() => {});
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create content");
    } finally {
      setIsSubmitting(false);
    }
  }, [userId, isFormValid, media, contentType, title, body, excerpt, visibility, orgId, createDocument, createTalkRoom, scheduledAt, durationMinutes, location, isOnline, meetingUrl, syncToCalendar, isRSVPEnabled, rsvpDeadline, minAttendees, notifyOnMinAttendees, recurrencePattern, recurrenceCustomRule, recurrenceUntil, createEventPage, eventPageTableData, blogPassword, notes, onSuccess, draftId]);

  return (
    <form className="create-content-form" onSubmit={handleSubmit}>
      <Stack gap="sm">
        {/* ─── Type + Org ─── */}
        <Group gap="sm" grow>
          <SegmentedControl
            value={contentType}
            onChange={(val) => setContentType(val as ContentType)}
            data={[
              { value: "post", label: (<Group gap={4} justify="center" wrap="nowrap"><MessageCircle size={14} /><Text size="sm">Post</Text></Group>) },
              { value: "meeting", label: (<Group gap={4} justify="center" wrap="nowrap"><Calendar size={14} /><Text size="sm">Meeting</Text></Group>) },
            ]}
            color="indigo"
            size="sm"
          />
          <Select
            placeholder="Organization"
            data={ORGANIZATION_OPTIONS}
            value={orgId}
            onChange={(value) => setOrgId(value || "inner_group")}
            size="sm"
          />
        </Group>

        {/* Blog password */}
        {orgAccessStatus.loading && (
          <Group gap={6}><Loader size={12} /><Text size="xs" c="dimmed">Checking access...</Text></Group>
        )}
        {!orgAccessStatus.loading && orgAccessStatus.needsPassword && !passwordVerified && (
          <Paper withBorder radius="sm" p="xs" bg="orange.0">
            <Group gap="xs" align="flex-end">
              <Lock size={14} color="var(--mantine-color-orange-6)" />
              <PasswordInput
                placeholder="Blog password"
                value={blogPassword}
                onChange={(e) => { setBlogPassword(e.currentTarget.value); setPasswordError(null); }}
                error={passwordError}
                size="xs"
                style={{ flex: 1 }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleVerifyPassword(); } }}
              />
              <Button size="xs" variant="light" onClick={handleVerifyPassword} loading={verifyingPassword}>Unlock</Button>
            </Group>
          </Paper>
        )}
        {!orgAccessStatus.loading && passwordVerified && (
          <Group gap={6}><ShieldCheck size={14} color="var(--mantine-color-green-6)" /><Text size="xs" c="green">Access granted</Text></Group>
        )}

        {/* ─── Drafts ─── */}
        {drafts.length > 0 && (
          <>
            <UnstyledButton onClick={() => setShowDrafts((o) => !o)}>
              <Group gap={4}>
                <FileText size={13} color="var(--mantine-color-dimmed)" />
                <Text size="xs" c="dimmed" td="underline">{drafts.length} draft{drafts.length !== 1 ? "s" : ""}</Text>
                <ChevronDown size={12} style={{ transform: showDrafts ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 150ms" }} />
              </Group>
            </UnstyledButton>
            <Collapse in={showDrafts}>
              <Stack gap={4}>
                {drafts.map((d) => (
                  <Paper key={d.id} withBorder radius="sm" p="xs">
                    <Group justify="space-between" wrap="nowrap">
                      <UnstyledButton onClick={() => handleLoadDraft(d)} style={{ flex: 1, minWidth: 0 }}>
                        <Group gap={6} wrap="nowrap">
                          {d.contentType === "meeting" ? <Calendar size={12} /> : <MessageCircle size={12} />}
                          <Text size="xs" truncate fw={500}>{d.title || "Untitled"}</Text>
                          <Text size="xs" c="dimmed">{new Date(d.updatedAt).toLocaleDateString()}</Text>
                        </Group>
                      </UnstyledButton>
                      <ActionIcon size="xs" variant="subtle" color="red" onClick={() => handleDeleteDraft(d.id)}><Trash2 size={11} /></ActionIcon>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </Collapse>
          </>
        )}

        {/* ─── Title ─── */}
        <TextInput
          placeholder={contentType === "meeting" ? "Meeting title" : "Post title"}
          required
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          size="sm"
          styles={{ input: { fontWeight: 600, fontSize: 16 } }}
        />

        {contentType === "meeting" && (
          <TextInput
            placeholder="url-slug (auto)"
            value={slug}
            onChange={(e) => setSlug(e.currentTarget.value)}
            size="xs"
            variant="filled"
            leftSection={<Text size="xs" c="dimmed">/</Text>}
          />
        )}

        {/* ─── Content body ─── */}
        <Box>
          <RichTextEditor
            content={body}
            onChange={(html) => setBody(html)}
            placeholder={contentType === "meeting" ? "Description (optional)" : "Write your post..."}
            minimal={contentType === "meeting"}
          />
        </Box>

        {/* ─── Excerpt + Visibility ─── */}
        {contentType === "post" && (
          <SimpleGrid cols={2} spacing="sm">
            <Textarea placeholder="Excerpt (optional)" value={excerpt} onChange={(e) => setExcerpt(e.currentTarget.value)} size="xs" minRows={1} maxRows={3} autosize />
            <Select placeholder="Visibility" data={VISIBILITY_OPTIONS} value={visibility} onChange={(value) => setVisibility(value || "PUBLIC")} size="xs" />
          </SimpleGrid>
        )}

        {contentType === "meeting" && (
          <Select placeholder="Visibility" data={VISIBILITY_OPTIONS} value={visibility} onChange={(value) => setVisibility(value || "PUBLIC")} size="xs" />
        )}

        {/* ─── Schedule & Location (Meeting) ─── */}
        {contentType === "meeting" && (
          <Paper withBorder radius="sm" p="xs">
            <Stack gap="xs">
              <SectionToggle label="Schedule & Location" icon={<Calendar size={13} />} opened={showSchedule} onToggle={() => setShowSchedule((o) => !o)} />
              <Collapse in={showSchedule}>
                <Stack gap="xs" pt={4}>
                  <SimpleGrid cols={2} spacing="xs">
                    <DateTimePicker placeholder="Date & time *" required value={scheduledAt} onChange={(value) => setScheduledAt(value ? new Date(value) : null)} size="xs" />
                    <NumberInput placeholder="Duration (min)" min={5} value={durationMinutes} onChange={(value) => setDurationMinutes(value || 60)} size="xs" rightSection={<Text size="xs" c="dimmed" pr={4}>min</Text>} />
                  </SimpleGrid>
                  {scheduledAt && <TimezonePreview date={scheduledAt} />}
                  <TextInput placeholder="Location" value={location} onChange={(e) => setLocation(e.currentTarget.value)} size="xs" />
                  <Checkbox label="Online meeting" checked={isOnline} onChange={(e) => setIsOnline(e.currentTarget.checked)} size="xs" />
                  {isOnline && <TextInput placeholder="Meeting URL (https://...)" required value={meetingUrl} onChange={(e) => setMeetingUrl(e.currentTarget.value)} size="xs" />}
                </Stack>
              </Collapse>
            </Stack>
          </Paper>
        )}

        {/* ─── RSVP (Meeting) ─── */}
        {contentType === "meeting" && (
          <Paper withBorder radius="sm" p="xs">
            <Stack gap="xs">
              <SectionToggle label="RSVP & Attendance" icon={<Users size={13} />} opened={showRsvp} onToggle={() => setShowRsvp((o) => !o)} />
              <Collapse in={showRsvp}>
                <Stack gap="xs" pt={4}>
                  <Checkbox label="Enable RSVP" checked={isRSVPEnabled} onChange={(e) => setIsRSVPEnabled(e.currentTarget.checked)} size="xs" />
                  {isRSVPEnabled && (
                    <SimpleGrid cols={2} spacing="xs">
                      <DateTimePicker placeholder="RSVP deadline" value={rsvpDeadline} onChange={(value) => setRsvpDeadline(value ? new Date(value) : null)} size="xs" clearable />
                      <NumberInput placeholder="Min attendees" min={1} value={minAttendees as number} onChange={(value) => setMinAttendees(value || "")} size="xs" />
                    </SimpleGrid>
                  )}
                  {isRSVPEnabled && minAttendees && (
                    <Checkbox label="Notify when minimum reached" checked={notifyOnMinAttendees} onChange={(e) => setNotifyOnMinAttendees(e.currentTarget.checked)} size="xs" />
                  )}
                </Stack>
              </Collapse>
            </Stack>
          </Paper>
        )}

        {/* ─── Recurrence (Meeting) ─── */}
        {contentType === "meeting" && (
          <Paper withBorder radius="sm" p="xs">
            <Stack gap="xs">
              <SectionToggle label="Recurrence" icon={<Repeat size={13} />} opened={showRecurrence} onToggle={() => setShowRecurrence((o) => !o)} />
              <Collapse in={showRecurrence}>
                <Stack gap="xs" pt={4}>
                  <Select placeholder="Repeat..." data={[{ value: "NONE", label: "Does not repeat" }, { value: "DAILY", label: "Daily" }, { value: "WEEKLY", label: "Weekly" }, { value: "MONTHLY", label: "Monthly" }, { value: "CUSTOM", label: "Custom..." }]} value={recurrencePattern} onChange={(value) => setRecurrencePattern(value || "NONE")} size="xs" />
                  {recurrencePattern === "CUSTOM" && <TextInput placeholder='e.g. "Every 2 weeks on Tuesday"' value={recurrenceCustomRule} onChange={(e) => setRecurrenceCustomRule(e.currentTarget.value)} size="xs" />}
                  {recurrencePattern !== "NONE" && <DateTimePicker placeholder="End date (optional)" value={recurrenceUntil} onChange={(value) => setRecurrenceUntil(value ? new Date(value) : null)} size="xs" clearable />}
                </Stack>
              </Collapse>
            </Stack>
          </Paper>
        )}

        {/* ─── Event Page (Meeting) ─── */}
        {contentType === "meeting" && (
          <Paper withBorder radius="sm" p="xs">
            <Stack gap="xs">
              <SectionToggle label="Event Page" icon={<LayoutGrid size={13} />} opened={showEventPage} onToggle={() => setShowEventPage((o) => !o)} />
              <Collapse in={showEventPage}>
                <Stack gap="xs" pt={4}>
                  <Checkbox label="Create an event page" checked={createEventPage} onChange={(e) => setCreateEventPage(e.currentTarget.checked)} size="xs" />
                  {createEventPage && (
                    <Paper withBorder radius="sm" p="xs" bg="gray.0">
                      <Stack gap={4}>
                        <Group justify="space-between">
                          <Text size="xs" fw={600}>Details Table</Text>
                          <Group gap={4}>
                            <Button size="compact-xs" variant="light" leftSection={<Plus size={10} />} onClick={() => setEventPageTableData((prev) => ({ columns: [...prev.columns, `Col ${prev.columns.length + 1}`], rows: prev.rows.map((row) => [...row, ""]) }))}>Col</Button>
                            <Button size="compact-xs" variant="light" leftSection={<Plus size={10} />} onClick={() => setEventPageTableData((prev) => ({ ...prev, rows: [...prev.rows, prev.columns.map(() => "")] }))} disabled={eventPageTableData.columns.length === 0}>Row</Button>
                          </Group>
                        </Group>
                        {eventPageTableData.columns.length > 0 ? (
                          <Table withTableBorder withColumnBorders>
                            <Table.Thead>
                              <Table.Tr>
                                {eventPageTableData.columns.map((col, ci) => (
                                  <Table.Th key={ci} p={4}>
                                    <Group gap={2} wrap="nowrap">
                                      <TextInput size="xs" value={col} onChange={(e) => setEventPageTableData((prev) => ({ ...prev, columns: prev.columns.map((c, i) => i === ci ? e.currentTarget.value : c) }))} variant="unstyled" fw={600} placeholder="Name" style={{ flex: 1 }} />
                                      <ActionIcon size={14} variant="subtle" color="red" onClick={() => setEventPageTableData((prev) => ({ columns: prev.columns.filter((_, i) => i !== ci), rows: prev.rows.map((row) => row.filter((_, i) => i !== ci)) }))}><Trash2 size={9} /></ActionIcon>
                                    </Group>
                                  </Table.Th>
                                ))}
                                <Table.Th w={20} />
                              </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                              {eventPageTableData.rows.map((row, ri) => (
                                <Table.Tr key={ri}>
                                  {row.map((cell, ci) => (
                                    <Table.Td key={ci} p={4}>
                                      <TextInput size="xs" value={cell} onChange={(e) => setEventPageTableData((prev) => ({ ...prev, rows: prev.rows.map((r, rIdx) => rIdx === ri ? r.map((c, cIdx) => cIdx === ci ? e.currentTarget.value : c) : r) }))} variant="unstyled" placeholder="..." />
                                    </Table.Td>
                                  ))}
                                  <Table.Td p={4}>
                                    <ActionIcon size={14} variant="subtle" color="red" onClick={() => setEventPageTableData((prev) => ({ ...prev, rows: prev.rows.filter((_, i) => i !== ri) }))}><Trash2 size={9} /></ActionIcon>
                                  </Table.Td>
                                </Table.Tr>
                              ))}
                            </Table.Tbody>
                          </Table>
                        ) : (
                          <Text size="xs" c="dimmed" ta="center">Add columns to build a table</Text>
                        )}
                      </Stack>
                    </Paper>
                  )}
                </Stack>
              </Collapse>
            </Stack>
          </Paper>
        )}

        {/* ─── Media ─── */}
        <Paper withBorder radius="sm" p="xs">
          <Stack gap="xs">
            <Group gap={6}>
              <ImageIcon size={13} />
              <Text size="xs" fw={600} c="dimmed" tt="uppercase" lts={0.5}>Media</Text>
            </Group>
            <MediaUpload files={media} onChange={(files) => setMedia(files)} maxFiles={5} maxSize={100} />
          </Stack>
        </Paper>

        {/* ─── Integrations ─── */}
        <Paper withBorder radius="sm" p="xs">
          <Stack gap="xs">
            <SectionToggle label="Integrations" icon={<Video size={13} />} opened={showIntegrations} onToggle={() => setShowIntegrations((o) => !o)} />
            <Collapse in={showIntegrations}>
              <Stack gap={6} pt={4}>
                <Checkbox label="Collaborative document" checked={createDocument} onChange={(e) => setCreateDocument(e.currentTarget.checked)} size="xs" />
                <Checkbox label="Talk room" checked={createTalkRoom} onChange={(e) => setCreateTalkRoom(e.currentTarget.checked)} size="xs" />
                {contentType === "meeting" && <Checkbox label="Sync to Nextcloud Calendar" checked={syncToCalendar} onChange={(e) => setSyncToCalendar(e.currentTarget.checked)} size="xs" />}
              </Stack>
            </Collapse>
          </Stack>
        </Paper>

        {/* ─── Advanced (Meeting) ─── */}
        {contentType === "meeting" && (
          <Paper withBorder radius="sm" p="xs">
            <Stack gap="xs">
              <SectionToggle label="Advanced" icon={<Settings size={13} />} opened={showAdvanced} onToggle={() => setShowAdvanced((o) => !o)} />
              <Collapse in={showAdvanced}>
                <Stack gap="xs" pt={4}>
                  <TextInput placeholder="Guide/Facilitator ID" value={guideId} onChange={(e) => setGuideId(e.currentTarget.value)} size="xs" />
                  <Textarea placeholder="Internal notes (organizers only)" minRows={2} value={notes} onChange={(e) => setNotes(e.currentTarget.value)} size="xs" />
                </Stack>
              </Collapse>
            </Stack>
          </Paper>
        )}

        {/* Error */}
        {error && <Text c="red" size="xs">{error}</Text>}

        {/* Actions */}
        <Group justify="space-between" pt={4}>
          <Button variant="subtle" size="xs" color="gray" leftSection={<Save size={14} />} onClick={handleSaveDraft} loading={savingDraft} disabled={!title.trim()}>
            {draftSaved ? "Saved!" : "Save Draft"}
          </Button>
          <Button type="submit" loading={isSubmitting} disabled={!isFormValid} color="indigo" size="sm" leftSection={contentType === "meeting" ? <Calendar size={16} /> : <Send size={16} />}>
            {contentType === "meeting" ? "Create Meeting" : "Publish"}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

// ─── Collapsible section header ───
function SectionToggle({ label, icon, opened, onToggle }: {
  label: string; icon: React.ReactNode; opened: boolean; onToggle: () => void;
}) {
  return (
    <UnstyledButton onClick={onToggle} style={{ width: "100%" }}>
      <Group gap={6}>
        <ChevronRight size={12} style={{ transform: opened ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 150ms" }} />
        {icon}
        <Text size="xs" fw={600} c="dimmed" tt="uppercase" lts={0.5}>{label}</Text>
      </Group>
    </UnstyledButton>
  );
}

// ─── Timezone preview for meeting times ───
const TIMEZONE_CONFIG = [
  { zone: "America/New_York", label: "EST" },
  { zone: "America/Los_Angeles", label: "PST" },
  { zone: "Europe/Paris", label: "Paris" },
] as const;

function formatInZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(date);
}

function TimezonePreview({ date }: { date: Date }) {
  return (
    <Group gap={8} mt={2}>
      {TIMEZONE_CONFIG.map(({ zone, label }) => (
        <Text key={zone} size="xs" c="dimmed">
          <Text span size="xs" fw={600} c="dimmed">{label}</Text>{" "}
          {formatInZone(date, zone)}
        </Text>
      ))}
    </Group>
  );
}
