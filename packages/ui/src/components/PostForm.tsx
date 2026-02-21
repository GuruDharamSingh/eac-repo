"use client";

import {
  Button,
  Checkbox,
  Divider,
  Group,
  Paper,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
} from "@mantine/core";
import { usePostForm, type PostFormData, type PostFormConfig } from "@elkdonis/hooks";
import { VISIBILITY_OPTIONS } from "@elkdonis/utils";
import { useState } from "react";
import { Image as ImageIcon, Video } from "lucide-react";
import { MediaUpload } from "./MediaUpload";
import { RichTextEditor } from "./RichTextEditor";

export { type PostFormData, type PostFormConfig } from "@elkdonis/hooks";

export interface PostFormProps {
  config?: PostFormConfig;
  onSubmit: (data: PostFormData) => Promise<void>;
  onSuccess?: () => void;
  submitButtonText?: string;
}

export function PostForm({
  config = {},
  onSubmit,
  onSuccess,
  submitButtonText = "Create Post",
}: PostFormProps) {
  const { formData, updateField, resetForm, isValid, config: mergedConfig } = usePostForm(config);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isValid) {
      setError("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit(formData);
      resetForm();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create post");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        {mergedConfig.visibleFields?.title && (
          <TextInput
            label="Title"
            placeholder="Enter post title"
            value={formData.title}
            onChange={(e) => updateField("title", e.target.value)}
            required
            error={!formData.title.trim() && error ? "Title is required" : undefined}
          />
        )}

        {mergedConfig.visibleFields?.body && (
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              Content <Text component="span" c="red" size="sm">*</Text>
            </Text>
            <RichTextEditor
              content={formData.body}
              onChange={(html) => updateField("body", html)}
              placeholder="What would you like to share?"
            />
            {!formData.body.trim() && error && (
              <Text c="red" size="xs">Content is required</Text>
            )}
          </Stack>
        )}

        {mergedConfig.visibleFields?.excerpt && (
          <Textarea
            label="Excerpt (Optional)"
            placeholder="Brief summary of your post"
            value={formData.excerpt}
            onChange={(e) => updateField("excerpt", e.target.value)}
            minRows={2}
            description="A short summary that will appear in the feed"
          />
        )}

        {mergedConfig.visibleFields?.visibility && (
          <Select
            label="Visibility"
            value={formData.visibility}
            onChange={(value) =>
              updateField("visibility", value as PostFormData["visibility"])
            }
            data={VISIBILITY_OPTIONS}
            required
          />
        )}

        {/* Media Attachments */}
        {mergedConfig.visibleFields?.media && (
          <Paper withBorder radius="md" p="md">
            <Stack gap="sm">
              <Group gap="xs">
                <ThemeIcon variant="light" size="sm">
                  <ImageIcon size={14} />
                </ThemeIcon>
                <Text size="sm" fw={500}>Media Attachments</Text>
              </Group>
              <MediaUpload
                files={formData.media}
                onChange={(files) => updateField("media", files)}
                maxFiles={5}
                maxSize={100}
              />
            </Stack>
          </Paper>
        )}

        {/* Nextcloud Integration */}
        {(mergedConfig.visibleFields?.createTalkRoom || mergedConfig.visibleFields?.createDocument) && (
          <Paper withBorder radius="md" p="md">
            <Stack gap="sm">
              <Group gap="xs">
                <ThemeIcon variant="light" size="sm">
                  <Video size={14} />
                </ThemeIcon>
                <Text size="sm" fw={500}>Nextcloud Integration</Text>
              </Group>
              <Divider />
              {mergedConfig.visibleFields?.createTalkRoom && (
                <Checkbox
                  label="Create Talk Room"
                  description="Create a Nextcloud Talk room for discussion"
                  checked={formData.createTalkRoom}
                  onChange={(e) => updateField("createTalkRoom", e.currentTarget.checked)}
                />
              )}
              {mergedConfig.visibleFields?.createDocument && (
                <Checkbox
                  label="Create Collaborative Document"
                  description="Create a shared document for collaboration"
                  checked={formData.createDocument}
                  onChange={(e) => updateField("createDocument", e.currentTarget.checked)}
                />
              )}
            </Stack>
          </Paper>
        )}

        {error && (
          <Text c="red" size="sm">
            {error}
          </Text>
        )}

        <Group justify="flex-end" mt="md">
          <Button type="submit" loading={isSubmitting} disabled={!isValid}>
            {submitButtonText}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
