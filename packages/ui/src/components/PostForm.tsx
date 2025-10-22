"use client";

import {
  Button,
  Group,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { usePostForm, type PostFormData, type PostFormConfig } from "@elkdonis/hooks";
import { VISIBILITY_OPTIONS } from "@elkdonis/utils";
import { useState } from "react";

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
  const { formData, updateField, resetForm, isValid } = usePostForm(config);
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
        <TextInput
          label="Title"
          placeholder="Enter post title"
          value={formData.title}
          onChange={(e) => updateField("title", e.target.value)}
          required
          error={!formData.title.trim() && error ? "Title is required" : undefined}
        />

        <Textarea
          label="Content"
          placeholder="What would you like to share?"
          value={formData.body}
          onChange={(e) => updateField("body", e.target.value)}
          required
          minRows={6}
          error={!formData.body.trim() && error ? "Content is required" : undefined}
        />

        <Textarea
          label="Excerpt (Optional)"
          placeholder="Brief summary of your post"
          value={formData.excerpt}
          onChange={(e) => updateField("excerpt", e.target.value)}
          minRows={2}
          description="A short summary that will appear in the feed"
        />

        <Select
          label="Visibility"
          value={formData.visibility}
          onChange={(value) =>
            updateField("visibility", value as PostFormData["visibility"])
          }
          data={VISIBILITY_OPTIONS}
          required
        />

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
