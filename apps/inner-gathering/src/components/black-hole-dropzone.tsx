"use client";

import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { File as FileIcon, Link2, Send, Sparkles, Trash2, UploadCloud, X } from "lucide-react";
import { createPostAction } from "@/lib/actions";

interface BlackHoleDropzoneProps {
  userId: string | null;
  onPublished?: () => void;
}

type UploadedMedia = {
  fileId: string;
  path: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  type: "image" | "video" | "audio" | "document";
};

const URL_PATTERN = /https?:\/\/[^\s]+/g;

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function extractUrls(value: string) {
  return Array.from(new Set(value.match(URL_PATTERN) ?? []));
}

function hostnameFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function buildTitle(note: string, files: File[]) {
  const firstLine = note.trim().split("\n").find(Boolean);
  const firstUrl = extractUrls(note)[0];

  if (firstLine && firstLine !== firstUrl) {
    return firstLine.replace(URL_PATTERN, "").trim().slice(0, 80) || "Field note";
  }

  if (firstUrl) return `Link: ${hostnameFromUrl(firstUrl)}`;
  if (files.length === 1) return `Drop: ${files[0].name}`;
  if (files.length > 1) return `Drop: ${files.length} files`;
  return "Field note";
}

async function uploadFiles(files: File[]): Promise<UploadedMedia[]> {
  const uploaded: UploadedMedia[] = [];

  for (const file of files) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `Failed to upload ${file.name}`);
    }

    const body = await response.json();
    if (!body?.success || !body?.fileId || !body?.path || !body?.url || !body?.mediaType) {
      throw new Error(`Invalid upload response for ${file.name}`);
    }

    uploaded.push({
      fileId: body.fileId,
      path: body.path,
      url: body.url,
      filename: body.filename,
      mimeType: body.mimeType,
      size: body.size,
      type: body.mediaType,
    });
  }

  return uploaded;
}

export function BlackHoleDropzone({ userId, onPublished }: BlackHoleDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const urls = useMemo(() => extractUrls(note), [note]);
  const canPublish = !!userId && (note.trim().length > 0 || files.length > 0);

  const addFiles = (nextFiles: File[]) => {
    setFiles((currentFiles) => {
      const existing = new Set(currentFiles.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      const uniqueFiles = nextFiles.filter((file) => !existing.has(`${file.name}-${file.size}-${file.lastModified}`));
      return [...currentFiles, ...uniqueFiles];
    });
  };

  const appendText = (value: string) => {
    const text = value.trim();
    if (!text) return;
    setNote((currentNote) => [currentNote.trim(), text].filter(Boolean).join("\n"));
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);

    const droppedFiles = Array.from(event.dataTransfer.files ?? []);
    if (droppedFiles.length > 0) addFiles(droppedFiles);

    const uriList = event.dataTransfer.getData("text/uri-list");
    const plainText = event.dataTransfer.getData("text/plain");
    appendText(uriList || plainText);
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.currentTarget.files ?? []));
    event.currentTarget.value = "";
  };

  const handlePublish = async () => {
    if (!userId || !canPublish) return;

    setPublishing(true);
    try {
      const uploadedMedia = await uploadFiles(files);
      const body = note.trim() || files.map((file) => file.name).join("\n");

      await createPostAction({
        userId,
        title: buildTitle(note, files),
        body,
        excerpt: urls.length > 0 ? urls.map(hostnameFromUrl).join(", ") : undefined,
        visibility: "PUBLIC",
        media: uploadedMedia.length > 0 ? uploadedMedia : undefined,
      });

      setNote("");
      setFiles([]);
      notifications.show({
        color: "green",
        title: "Dropped into the feed",
        message: "Your post is live.",
      });
      onPublished?.();
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Drop failed",
        message: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Paper
      withBorder
      radius="sm"
      p="md"
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      style={{
        borderColor: dragging ? "#f0a040" : "#3d1f0a",
        background: "linear-gradient(160deg, #150f0a 0%, #2a160b 58%, #42240f 100%)",
        boxShadow: dragging ? "0 0 0 2px rgba(240, 160, 64, 0.35)" : "0 8px 28px rgba(45, 20, 8, 0.22)",
        color: "#fdf0d0",
        overflow: "hidden",
      }}
    >
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon size="lg" radius="sm" variant="filled" color="ember">
              <Sparkles size={18} />
            </ThemeIcon>
            <Box>
              <Text fw={700} style={{ color: "#fff3d8", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Black Hole
              </Text>
              <Text size="xs" style={{ color: "#d9b47a", fontStyle: "italic" }}>
                Links, media, notes, fragments
              </Text>
            </Box>
          </Group>
          <Group gap="xs" wrap="nowrap">
            <Tooltip label="Choose files">
              <ActionIcon
                variant="subtle"
                color="orange"
                aria-label="Choose files"
                onClick={() => inputRef.current?.click()}
              >
                <UploadCloud size={18} />
              </ActionIcon>
            </Tooltip>
            {(note || files.length > 0) && (
              <Tooltip label="Clear">
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  aria-label="Clear dropzone"
                  onClick={() => {
                    setNote("");
                    setFiles([]);
                  }}
                >
                  <X size={18} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        </Group>

        <input ref={inputRef} type="file" multiple hidden onChange={handleFileInput} />

        <Textarea
          variant="unstyled"
          minRows={3}
          maxRows={8}
          autosize
          value={note}
          disabled={!userId || publishing}
          onChange={(event) => setNote(event.currentTarget.value)}
          placeholder={userId ? "Drop or paste something..." : "Sign in to drop something..."}
          styles={{
            input: {
              color: "#fff8ec",
              background: "rgba(255, 252, 244, 0.06)",
              border: "1px solid rgba(240, 201, 138, 0.22)",
              borderRadius: 6,
              padding: "0.75rem",
            },
          }}
        />

        {(files.length > 0 || urls.length > 0) && (
          <Group gap="xs">
            {urls.map((url) => (
              <Badge key={url} color="yellow" variant="light" leftSection={<Link2 size={12} />}>
                {hostnameFromUrl(url)}
              </Badge>
            ))}
            {files.map((file) => (
              <Badge
                key={`${file.name}-${file.size}-${file.lastModified}`}
                color="orange"
                variant="light"
                leftSection={<FileIcon size={12} />}
                rightSection={
                  <ActionIcon
                    size={14}
                    variant="transparent"
                    color="orange"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => setFiles((currentFiles) => currentFiles.filter((currentFile) => currentFile !== file))}
                  >
                    <Trash2 size={10} />
                  </ActionIcon>
                }
              >
                {file.name} - {formatBytes(file.size)}
              </Badge>
            ))}
          </Group>
        )}

        <Group justify="space-between" align="center">
          <Text size="xs" style={{ color: "#b98955" }}>
            {files.length > 0 ? `${files.length} file${files.length === 1 ? "" : "s"} queued` : "Ready"}
          </Text>
          <Button
            size="sm"
            color="ember"
            leftSection={<Send size={16} />}
            loading={publishing}
            disabled={!canPublish || publishing}
            onClick={handlePublish}
          >
            Drop
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}