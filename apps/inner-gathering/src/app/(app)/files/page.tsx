"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Breadcrumbs,
  Button,
  Container,
  Divider,
  Group,
  Loader,
  Menu,
  Paper,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
  Anchor,
} from "@mantine/core";
import {
  ChevronLeft,
  Download,
  File,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Folder,
  FolderPlus,
  Home,
  Image,
  Mic,
  MoreVertical,
  Plus,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";

interface NextcloudFile {
  filename: string;
  basename: string;
  lastmod: string;
  size: number;
  type: "file" | "directory";
  etag: string;
  mime?: string;
}

type MediaCategory = "Images" | "Audio" | "Videos" | "Documents";

interface StagedFile {
  file: File;
  category: MediaCategory;
  id: string;
}

const ORG_ROOT = "EAC_Network/inner_group";

const MEDIA_CATEGORIES: { value: MediaCategory; label: string; icon: React.ReactNode; color: string; accept: string }[] = [
  { value: "Images", label: "Images", icon: <Image size={18} />, color: "moss", accept: "image/*" },
  { value: "Audio", label: "Audio", icon: <Mic size={18} />, color: "oxblood", accept: "audio/*" },
  { value: "Videos", label: "Videos", icon: <Video size={18} />, color: "red", accept: "video/*" },
  { value: "Documents", label: "Documents", icon: <FileText size={18} />, color: "archive", accept: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv,.rtf" },
];

function detectCategory(file: File): MediaCategory {
  const mime = file.type || "";
  if (mime.startsWith("image/")) return "Images";
  if (mime.startsWith("audio/")) return "Audio";
  if (mime.startsWith("video/")) return "Videos";
  return "Documents";
}

function getFileIcon(file: NextcloudFile) {
  if (file.type === "directory") return <Folder size={20} />;
  const mime = file.mime || "";
  if (mime.startsWith("image/")) return <FileImage size={20} />;
  if (mime.startsWith("audio/")) return <FileAudio size={20} />;
  if (mime.startsWith("video/")) return <FileVideo size={20} />;
  if (
    mime.startsWith("text/") ||
    mime.includes("pdf") ||
    mime.includes("document") ||
    mime.includes("spreadsheet") ||
    mime.includes("presentation")
  )
    return <FileText size={20} />;
  return <File size={20} />;
}

function getFileColor(file: NextcloudFile): string {
  if (file.type === "directory") return "archive";
  const mime = file.mime || "";
  if (mime.startsWith("image/")) return "moss";
  if (mime.startsWith("audio/")) return "oxblood";
  if (mime.startsWith("video/")) return "red";
  if (mime.includes("pdf")) return "archive";
  return "gray";
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

export default function FilesPage() {
  const [currentPath, setCurrentPath] = useState(ORG_ROOT);
  const [files, setFiles] = useState<NextcloudFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropzoneRef = useRef<HTMLDivElement>(null);
  const dragCounter = useRef(0);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/nextcloud/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list", path: currentPath }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to load files");
      }

      const data = await response.json();
      // Sort: folders first, then by name
      const sorted = (data.files || []).sort(
        (a: NextcloudFile, b: NextcloudFile) => {
          if (a.type !== b.type)
            return a.type === "directory" ? -1 : 1;
          return a.basename.localeCompare(b.basename);
        }
      );
      setFiles(sorted);
    } catch (err: any) {
      console.error("Error loading files:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentPath]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      stageFiles(droppedFiles);
    }
  }, []);

  // Stage files for upload with auto-detected categories
  const stageFiles = (fileList: File[]) => {
    const newStaged: StagedFile[] = fileList.map((file) => ({
      file,
      category: detectCategory(file),
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    }));
    setStagedFiles((prev) => [...prev, ...newStaged]);
  };

  // Handle file input change
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;
    stageFiles(Array.from(fileList));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Update category of a staged file
  const updateStagedCategory = (id: string, category: MediaCategory) => {
    setStagedFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, category } : f))
    );
  };

  // Remove a staged file
  const removeStagedFile = (id: string) => {
    setStagedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Upload all staged files
  const handleUploadStaged = async () => {
    if (stagedFiles.length === 0) return;

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      for (let i = 0; i < stagedFiles.length; i++) {
        const staged = stagedFiles[i];
        const uploadPath = `${ORG_ROOT}/Media/${staged.category}/${staged.file.name}`;

        const formData = new FormData();
        formData.append("file", staged.file);
        formData.append("path", uploadPath);

        const response = await fetch("/api/nextcloud/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || `Failed to upload ${staged.file.name}`);
        }

        setUploadProgress(((i + 1) / stagedFiles.length) * 100);
      }

      setStagedFiles([]);
      await loadFiles();
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err.message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Navigate into folder
  const handleItemClick = (item: NextcloudFile) => {
    if (item.type === "directory") {
      setCurrentPath(item.filename);
    }
  };

  // Go back
  const handleGoBack = () => {
    const parts = currentPath.split("/").filter(Boolean);
    if (parts.length > 2) {
      parts.pop();
      const newPath = parts.join("/");
      setCurrentPath(newPath);
    }
  };

  // Breadcrumbs
  const getBreadcrumbs = () => {
    const relativePath = currentPath
      .replace(ORG_ROOT, "")
      .replace(/^\/+/, "");
    const parts = relativePath ? relativePath.split("/") : [];

    return [
      { label: "Inner Gathering", path: ORG_ROOT },
      ...parts.map((part, i) => ({
        label: part,
        path: ORG_ROOT + "/" + parts.slice(0, i + 1).join("/"),
      })),
    ];
  };

  // Create folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      const response = await fetch("/api/nextcloud/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createFolder",
          path: `${currentPath}/${newFolderName.trim()}`,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create folder");
      }

      setNewFolderName("");
      setShowNewFolder(false);
      await loadFiles();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Delete file/folder
  const handleDelete = async (file: NextcloudFile) => {
    const label = file.type === "directory" ? "folder" : "file";
    if (!confirm(`Delete ${label} "${file.basename}"?`)) return;

    try {
      const response = await fetch("/api/nextcloud/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", path: file.filename }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete");
      }

      await loadFiles();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Download file
  const handleDownload = async (file: NextcloudFile) => {
    try {
      const response = await fetch("/api/nextcloud/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "download", path: file.filename }),
      });

      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.basename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const isAtRoot = currentPath === ORG_ROOT;
  const breadcrumbs = getBreadcrumbs();
  const dirCount = files.filter((f) => f.type === "directory").length;
  const fileCount = files.filter((f) => f.type === "file").length;

  return (
    <Box className="archive-shell">
    <Container
      size="md"
      py="lg"
      pb={120}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="flex-start" className="archive-page-header">
          <div>
            <Text className="archive-kicker">Archive room</Text>
            <Title order={2} className="archive-title">Archive</Title>
            <Text size="sm" className="archive-muted">
              Deposit and tend community media, documents, traces, and working files
            </Text>
          </div>
        </Group>

        {/* Upload Zone */}
        <Paper
          ref={dropzoneRef}
          withBorder
          radius="sm"
          p="lg"
          className="archive-card"
          style={{
            borderStyle: "dashed",
            borderWidth: 2,
            borderColor: isDragging
              ? "var(--ig-ember)"
              : stagedFiles.length > 0
              ? "var(--ig-gold)"
              : "var(--ig-border)",
            backgroundColor: isDragging
              ? "rgba(200, 145, 10, 0.12)"
              : stagedFiles.length > 0
              ? "rgba(200, 145, 10, 0.08)"
              : undefined,
            transition: "all 200ms ease",
          }}
        >
          {stagedFiles.length === 0 ? (
            /* Empty dropzone state */
            <Stack align="center" gap="sm" py="md">
              <ThemeIcon size={48} radius="sm" variant="light" color="archive">
                <Upload size={24} />
              </ThemeIcon>
              <Text fw={500} size="lg">
                {isDragging ? "Drop files into the archive" : "Deposit into the archive"}
              </Text>
              <Text size="sm" className="archive-muted" ta="center">
                Drag &amp; drop files here, or click to browse.
                <br />
                Files are auto-sorted into Images, Audio, Videos, or Documents.
              </Text>
              <Button
                variant="light"
                color="archive"
                leftSection={<Upload size={16} />}
                component="label"
                mt="xs"
              >
                Choose Files
                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  multiple
                  onChange={handleFileSelect}
                />
              </Button>
            </Stack>
          ) : (
            /* Staged files list */
            <Stack gap="sm">
              <Group justify="space-between">
                <Text fw={600} size="sm">
                  {stagedFiles.length} file{stagedFiles.length !== 1 ? "s" : ""} ready to upload
                </Text>
                <Group gap="xs">
                  <Button
                    variant="subtle"
                    size="xs"
                    color="gray"
                    component="label"
                    leftSection={<Plus size={14} />}
                  >
                    Add more
                    <input
                      ref={fileInputRef}
                      type="file"
                      hidden
                      multiple
                      onChange={handleFileSelect}
                    />
                  </Button>
                  <Button
                    variant="subtle"
                    size="xs"
                    color="red"
                    onClick={() => setStagedFiles([])}
                  >
                    Clear all
                  </Button>
                </Group>
              </Group>

              {stagedFiles.map((staged) => (
                <Paper key={staged.id} withBorder radius="sm" p="xs" bg="white">
                  <Group justify="space-between" wrap="nowrap" gap="sm">
                    <Group gap="sm" style={{ flex: 1, minWidth: 0 }}>
                      <ThemeIcon
                        variant="light"
                        color={MEDIA_CATEGORIES.find((c) => c.value === staged.category)?.color || "gray"}
                        size="sm"
                      >
                        {MEDIA_CATEGORIES.find((c) => c.value === staged.category)?.icon || <File size={14} />}
                      </ThemeIcon>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <Text size="sm" truncate="end">
                          {staged.file.name}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {formatSize(staged.file.size)}
                        </Text>
                      </div>
                    </Group>
                    <Group gap="xs" wrap="nowrap">
                      <Select
                        size="xs"
                        w={130}
                        value={staged.category}
                        onChange={(val) => {
                          if (val) updateStagedCategory(staged.id, val as MediaCategory);
                        }}
                        data={MEDIA_CATEGORIES.map((c) => ({
                          value: c.value,
                          label: c.label,
                        }))}
                        comboboxProps={{ withinPortal: true }}
                      />
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size="sm"
                        onClick={() => removeStagedFile(staged.id)}
                      >
                        <X size={14} />
                      </ActionIcon>
                    </Group>
                  </Group>
                </Paper>
              ))}

              {uploading && (
                <Progress
                  value={uploadProgress}
                  size="sm"
                  color="archive"
                  animated
                />
              )}

              <Button
                color="archive"
                leftSection={uploading ? <Loader size={16} color="white" /> : <Upload size={16} />}
                onClick={handleUploadStaged}
                disabled={uploading}
                fullWidth
              >
                {uploading
                  ? `Uploading... ${Math.round(uploadProgress)}%`
                  : `Upload ${stagedFiles.length} file${stagedFiles.length !== 1 ? "s" : ""}`}
              </Button>
            </Stack>
          )}
        </Paper>

        {/* Quick category navigation */}
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
          {MEDIA_CATEGORIES.map((cat) => (
            <Paper
              key={cat.value}
              withBorder
              radius="sm"
              p="sm"
              className="archive-tile"
              style={{ cursor: "pointer", transition: "background-color 150ms" }}
              onClick={() => setCurrentPath(`${ORG_ROOT}/Media/${cat.value}`)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = `var(--mantine-color-${cat.color}-0)`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "";
              }}
            >
              <Group gap="xs">
                <ThemeIcon variant="light" color={cat.color} size="md" radius="md">
                  {cat.icon}
                </ThemeIcon>
                <Text size="sm" fw={500}>
                  {cat.label}
                </Text>
              </Group>
            </Paper>
          ))}
        </SimpleGrid>

        <Divider />

        {/* Toolbar */}
        <Paper withBorder radius="sm" p="sm" className="archive-card">
          <Group justify="space-between">
            <Group gap="xs">
              <ActionIcon
                variant="subtle"
                onClick={handleGoBack}
                disabled={isAtRoot}
                size="lg"
              >
                <ChevronLeft size={18} />
              </ActionIcon>

              <Breadcrumbs separator="/">
                {breadcrumbs.map((crumb, i) => (
                  <Anchor
                    key={crumb.path}
                    size="sm"
                    onClick={() => setCurrentPath(crumb.path)}
                    c={i === breadcrumbs.length - 1 ? undefined : "dimmed"}
                    fw={i === breadcrumbs.length - 1 ? 600 : 400}
                    style={{ cursor: "pointer" }}
                    underline="never"
                  >
                    {i === 0 ? (
                      <Group gap={4}>
                        <Home size={14} />
                        {crumb.label}
                      </Group>
                    ) : (
                      crumb.label
                    )}
                  </Anchor>
                ))}
              </Breadcrumbs>
            </Group>

            <Group gap="xs">
              {showNewFolder ? (
                <Group gap="xs">
                  <TextInput
                    size="xs"
                    placeholder="Folder name"
                    value={newFolderName}
                    onChange={(e) =>
                      setNewFolderName(e.currentTarget.value)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateFolder();
                      if (e.key === "Escape") {
                        setShowNewFolder(false);
                        setNewFolderName("");
                      }
                    }}
                    autoFocus
                  />
                  <Button size="xs" color="archive" onClick={handleCreateFolder}>
                    Create
                  </Button>
                  <ActionIcon
                    variant="subtle"
                    size="sm"
                    onClick={() => {
                      setShowNewFolder(false);
                      setNewFolderName("");
                    }}
                  >
                    <X size={14} />
                  </ActionIcon>
                </Group>
              ) : (
                <Tooltip label="New Folder">
                    <ActionIcon
                      variant="light"
                      color="archive"
                    onClick={() => setShowNewFolder(true)}
                  >
                    <FolderPlus size={18} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          </Group>
        </Paper>

        {/* Error */}
        {error && (
          <Paper withBorder radius="sm" p="sm" bg="red.0">
            <Group justify="space-between">
              <Text size="sm" c="red">
                {error}
              </Text>
              <ActionIcon
                variant="subtle"
                color="red"
                size="sm"
                onClick={() => setError(null)}
              >
                <X size={14} />
              </ActionIcon>
            </Group>
          </Paper>
        )}

        {/* File count summary */}
        {!loading && files.length > 0 && (
          <Group gap="xs">
            {dirCount > 0 && (
              <Badge variant="light" color="archive" size="sm">
                {dirCount} folder{dirCount !== 1 ? "s" : ""}
              </Badge>
            )}
            {fileCount > 0 && (
              <Badge variant="light" color="gray" size="sm">
                {fileCount} file{fileCount !== 1 ? "s" : ""}
              </Badge>
            )}
          </Group>
        )}

        {/* File List */}
        {loading ? (
          <Group justify="center" py="xl">
            <Loader color="archive" />
          </Group>
        ) : files.length === 0 ? (
          <Paper withBorder radius="sm" p="xl" ta="center" className="archive-card">
            <Stack align="center" gap="sm">
              <ThemeIcon
                size={48}
                radius="sm"
                variant="light"
                color="gray"
              >
                <Folder size={24} />
              </ThemeIcon>
              <Text c="dimmed">This folder is empty</Text>
              <Button
                size="xs"
                variant="light"
                leftSection={<FolderPlus size={14} />}
                onClick={() => setShowNewFolder(true)}
              >
                New Folder
              </Button>
            </Stack>
          </Paper>
        ) : (
          <Stack gap={4}>
            {files.map((file) => (
              <Paper
                key={file.filename}
                withBorder
                radius="sm"
                p="sm"
                className="archive-tile"
                style={{
                  cursor:
                    file.type === "directory" ? "pointer" : "default",
                  transition: "background-color 150ms",
                }}
                onClick={() => handleItemClick(file)}
                onMouseEnter={(e) => {
                  if (file.type === "directory") {
                    e.currentTarget.style.backgroundColor =
                      "rgba(200, 145, 10, 0.1)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "";
                }}
              >
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="sm" style={{ flex: 1, minWidth: 0 }}>
                    <ThemeIcon
                      variant="light"
                      color={getFileColor(file)}
                      size="md"
                      radius="md"
                    >
                      {getFileIcon(file)}
                    </ThemeIcon>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <Text
                        size="sm"
                        fw={file.type === "directory" ? 600 : 400}
                        truncate="end"
                      >
                        {file.basename}
                      </Text>
                      <Group gap="xs">
                        {file.size > 0 && (
                          <Text size="xs" c="dimmed">
                            {formatSize(file.size)}
                          </Text>
                        )}
                        <Text size="xs" c="dimmed">
                          {formatDate(file.lastmod)}
                        </Text>
                      </Group>
                    </div>
                  </Group>

                  {/* Actions */}
                  <Menu shadow="md" position="bottom-end" withArrow>
                    <Menu.Target>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical size={16} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      {file.type === "file" && (
                        <Menu.Item
                          leftSection={<Download size={14} />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(file);
                          }}
                        >
                          Download
                        </Menu.Item>
                      )}
                      <Menu.Item
                        leftSection={<Trash2 size={14} />}
                        color="red"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(file);
                        }}
                      >
                        Delete
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>
    </Container>
    </Box>
  );
}
