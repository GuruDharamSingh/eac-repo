"use client";

import { useEffect, useState } from "react";
import { Badge, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { FileText, FolderOpen, Upload as UploadIcon } from "lucide-react";

// ============================================================================
// Materials list + upload. Used on the workshop detail page (all viewers,
// access enforced server-side) and in the Content Form (author, once the
// workshop has been saved at least once). Fetches/posts to the app's own
// /api/workshops/[id]/materials — same-origin, so this works in any app that
// implements that route against the shared @elkdonis/nextcloud functions.
// ============================================================================

interface MaterialFile {
  name: string;
  size: number;
  mimeType: string | null;
  lastModified: string | null;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function WorkshopMaterials({ workshopId }: { workshopId: string }) {
  const [files, setFiles] = useState<MaterialFile[] | null>(null);
  const [isAuthor, setIsAuthor] = useState(false);
  const [denied, setDenied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const load = () => {
    fetch(`/api/workshops/${workshopId}/materials`)
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          setDenied(true);
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        setFiles(data.files ?? []);
        setIsAuthor(Boolean(data.isAuthor));
      })
      .catch(() => setFiles([]));
  };

  useEffect(load, [workshopId]);

  const handleDrop = async (dropped: File[]) => {
    const file = dropped[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/workshops/${workshopId}/materials`, { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Upload failed");
      }
      load();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // Not enrolled — render nothing (the join CTA is elsewhere on the page)
  if (denied) return null;
  if (files === null) return null;

  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" mb="sm">
        <Group gap="xs">
          <FolderOpen size={18} color="#9a7650" />
          <Title order={4} style={{ fontFamily: "'Cinzel', serif", color: "#3d1f04" }}>
            Materials
          </Title>
          {isAuthor && (
            <Badge size="sm" variant="light" color="orange">
              you can upload
            </Badge>
          )}
        </Group>
      </Group>

      {files.length === 0 ? (
        <Text size="sm" c="dimmed" mb={isAuthor ? "sm" : 0}>
          {isAuthor
            ? "No materials yet — upload readings, prompts, or recordings below."
            : "No materials have been shared yet. Check back before the first session."}
        </Text>
      ) : (
        <Stack gap={6} mb={isAuthor ? "sm" : 0}>
          {files.map((f) => (
            <a
              key={f.name}
              href={`/api/workshops/${workshopId}/materials/${encodeURIComponent(f.name)}`}
              style={{ textDecoration: "none", cursor: "pointer", color: "inherit" }}
            >
              <Group gap="sm" wrap="nowrap">
                <FileText size={14} color="#9a7650" style={{ flexShrink: 0 }} />
                <Text size="sm" c="#3d1f04" style={{ flex: 1, minWidth: 0 }} truncate>
                  {f.name}
                </Text>
                <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                  {fmtSize(f.size)}
                </Text>
              </Group>
            </a>
          ))}
        </Stack>
      )}

      {isAuthor && (
        <>
          <Dropzone onDrop={handleDrop} loading={uploading} maxSize={200 * 1024 * 1024} p="xs">
            <Group justify="center" gap="sm" mih={40} style={{ pointerEvents: "none" }}>
              <UploadIcon size={16} color="#9a7650" />
              <Text size="sm" c="dimmed">Drop a file or click to upload</Text>
            </Group>
          </Dropzone>
          {uploadError && (
            <Text size="xs" c="red" mt={4}>{uploadError}</Text>
          )}
        </>
      )}
    </Paper>
  );
}
