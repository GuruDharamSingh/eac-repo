"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Divider,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { Image, Link2, Plus, RefreshCw, Save, Trash2 } from "lucide-react";

interface EditableLink {
  label: string;
  url: string;
}

interface EditableMedia {
  url: string;
  alt: string;
  caption: string;
}

type EditableTemplateKey = "welcome" | "newsletter";

interface EditableTemplateEditorProps {
  templateKey: EditableTemplateKey;
  title: string;
  description: string;
  initialHtml: string;
  defaultBodyText: string;
  defaultLinks: EditableLink[];
  defaultMedia?: EditableMedia[];
}

export function EditableTemplateEditor({
  templateKey,
  title,
  description,
  initialHtml,
  defaultBodyText,
  defaultLinks,
  defaultMedia = [],
}: EditableTemplateEditorProps) {
  const [displayName, setDisplayName] = useState("New Member");
  const [portalUrl, setPortalUrl] = useState("http://localhost:3004/feed?welcome=1");
  const [newsletterTitle, setNewsletterTitle] = useState("A Letter From The Collective");
  const [previewText, setPreviewText] = useState("Updates, invitations, and notes from Elkdonis Arts Collective.");
  const [bodyText, setBodyText] = useState(defaultBodyText);
  const [links, setLinks] = useState<EditableLink[]>(defaultLinks);
  const [media, setMedia] = useState<EditableMedia[]>(defaultMedia);
  const [html, setHtml] = useState(initialHtml);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const payload = useMemo(
    () => ({
      templateKey,
      displayName,
      portalUrl,
      newsletterTitle,
      previewText,
      bodyText,
      links,
      media,
    }),
    [bodyText, displayName, links, media, newsletterTitle, portalUrl, previewText, templateKey]
  );

  const renderPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/email-templates/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Preview render failed");

      const data = await response.json();
      setHtml(data.html);
    } catch (previewError) {
      console.error("Email preview render failed:", previewError);
      setError("The preview could not be rendered. Check the links, media URLs, and sample fields.");
    } finally {
      setLoading(false);
    }
  };

  const loadSavedSettings = async () => {
    try {
      const response = await fetch(`/api/email-templates/settings/${templateKey}`);
      if (!response.ok) return;

      const data = await response.json();
      const config = data.settings?.config;
      if (!config) return;

      if (typeof config.bodyText === "string") setBodyText(config.bodyText);
      if (Array.isArray(config.links)) setLinks(config.links);
      if (Array.isArray(config.media)) {
        setMedia(config.media.map((item: Partial<EditableMedia>) => ({
          url: item.url ?? "",
          alt: item.alt ?? "",
          caption: item.caption ?? "",
        })));
      }

      if (data.settings?.updatedAt) {
        setSaveMessage(`Loaded saved settings from ${new Date(data.settings.updatedAt).toLocaleString()}`);
      }
    } catch (loadError) {
      console.error("Email template settings load failed:", loadError);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      const response = await fetch(`/api/email-templates/settings/${templateKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: { bodyText, links, media } }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Save failed");
      }

      const data = await response.json();
      setSaveMessage(`Saved ${new Date(data.settings.updatedAt).toLocaleString()}`);
    } catch (saveError) {
      console.error("Email template settings save failed:", saveError);
      setError(saveError instanceof Error ? saveError.message : "The template settings could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadSavedSettings();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      renderPreview();
    }, 450);
    return () => window.clearTimeout(timer);
  }, [payload]);

  const updateLink = (index: number, field: keyof EditableLink, value: string) => {
    setLinks((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  };

  const updateMedia = (index: number, field: keyof EditableMedia, value: string) => {
    setMedia((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  };

  return (
    <Paper
      withBorder
      radius="sm"
      p="md"
      style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
    >
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start" gap="md">
          <Stack gap={4} style={{ flex: 1 }}>
            <Title order={4} style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
              {title}
            </Title>
            <Text size="sm" c="dimmed">{description}</Text>
          </Stack>
          <Group gap="xs">
            <Button
              size="xs"
              variant="light"
              color="archive"
              leftSection={<RefreshCw size={14} />}
              onClick={renderPreview}
              loading={loading}
            >
              Refresh
            </Button>
            <Button
              size="xs"
              color="eacSky"
              leftSection={<Save size={14} />}
              onClick={saveSettings}
              loading={saving}
            >
              Save template
            </Button>
          </Group>
        </Group>

        {error && <Alert color="red" variant="light">{error}</Alert>}
        {saveMessage && <Alert color="teal" variant="light">{saveMessage}</Alert>}

        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
          <Stack gap="md">
            {templateKey === "welcome" ? (
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <TextInput label="Sample member name" value={displayName} onChange={(event) => setDisplayName(event.currentTarget.value)} />
                <TextInput label="Member portal link" value={portalUrl} onChange={(event) => setPortalUrl(event.currentTarget.value)} />
              </SimpleGrid>
            ) : (
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <TextInput label="Sample newsletter title" value={newsletterTitle} onChange={(event) => setNewsletterTitle(event.currentTarget.value)} />
                <TextInput label="Inbox preview text" value={previewText} onChange={(event) => setPreviewText(event.currentTarget.value)} />
              </SimpleGrid>
            )}

            <Textarea
              label="Body text"
              description="Line breaks become separate paragraphs in the preview."
              minRows={7}
              autosize
              value={bodyText}
              onChange={(event) => setBodyText(event.currentTarget.value)}
            />

            <Divider label="Links" labelPosition="left" />
            <Stack gap="xs">
              {links.map((link, index) => (
                <Group key={index} align="flex-end" gap="xs" wrap="nowrap">
                  <TextInput
                    label="Label"
                    value={link.label}
                    onChange={(event) => updateLink(index, "label", event.currentTarget.value)}
                    leftSection={<Link2 size={14} />}
                    style={{ flex: 1 }}
                  />
                  <TextInput
                    label="URL"
                    value={link.url}
                    onChange={(event) => updateLink(index, "url", event.currentTarget.value)}
                    style={{ flex: 2 }}
                  />
                  <ActionIcon color="red" variant="light" onClick={() => setLinks((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                    <Trash2 size={16} />
                  </ActionIcon>
                </Group>
              ))}
              <Button size="xs" variant="light" color="archive" leftSection={<Plus size={14} />} onClick={() => setLinks((current) => [...current, { label: "New link", url: "https://" }])}>
                Add link
              </Button>
            </Stack>

            <Divider label="Media" labelPosition="left" />
            <Stack gap="xs">
              {media.map((item, index) => (
                <Paper key={index} withBorder radius="sm" p="xs">
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Group gap="xs">
                        <Image size={14} />
                        <Text size="sm" fw={600}>Media block {index + 1}</Text>
                      </Group>
                      <ActionIcon color="red" variant="light" onClick={() => setMedia((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                        <Trash2 size={16} />
                      </ActionIcon>
                    </Group>
                    <TextInput label="Image URL" value={item.url} onChange={(event) => updateMedia(index, "url", event.currentTarget.value)} />
                    <TextInput label="Alt text" value={item.alt} onChange={(event) => updateMedia(index, "alt", event.currentTarget.value)} />
                    <TextInput label="Caption" value={item.caption} onChange={(event) => updateMedia(index, "caption", event.currentTarget.value)} />
                  </Stack>
                </Paper>
              ))}
              <Button size="xs" variant="light" color="archive" leftSection={<Plus size={14} />} onClick={() => setMedia((current) => [...current, { url: "https://", alt: "", caption: "" }])}>
                Add media
              </Button>
            </Stack>
          </Stack>

          <Box
            style={{
              border: "1px solid var(--ig-gold)",
              borderRadius: 6,
              overflow: "hidden",
              background: "#fff",
              minHeight: 680,
            }}
          >
            <iframe
              title={`Editable ${templateKey} email preview`}
              srcDoc={html}
              style={{ width: "100%", height: 680, border: 0, display: "block", background: "#fff" }}
            />
          </Box>
        </SimpleGrid>
      </Stack>
    </Paper>
  );
}