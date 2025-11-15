'use client';

import { TextInput, Textarea, TagsInput, Switch, Button, Stack, Group, Paper, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { MediaUpload } from './MediaUpload';
import { RichTextEditor } from './RichTextEditor';

export interface BlogEntryFormData {
  title: string;
  body: string;
  excerpt?: string;
  link?: string;
  tags: string[];
  media: File[];
  createForumThread: boolean;
  forumThreadTitle?: string;
}

export interface BlogEntryFormProps {
  onSubmit: (data: BlogEntryFormData) => Promise<void>;
  initialValues?: Partial<BlogEntryFormData>;
  submitLabel?: string;
  orgName?: string;
  isSubmitting?: boolean;
}

export function BlogEntryForm({
  onSubmit,
  initialValues,
  submitLabel = 'Publish',
  orgName,
  isSubmitting = false
}: BlogEntryFormProps) {
  const form = useForm<BlogEntryFormData>({
    initialValues: {
      title: initialValues?.title || '',
      body: initialValues?.body || '',
      excerpt: initialValues?.excerpt || '',
      link: initialValues?.link || '',
      tags: initialValues?.tags || [],
      media: initialValues?.media || [],
      createForumThread: initialValues?.createForumThread ?? true,
      forumThreadTitle: initialValues?.forumThreadTitle || '',
    },

    validate: {
      title: (value) => (value.trim().length < 3 ? 'Title must be at least 3 characters' : null),
      body: (value) => (value.trim().length < 10 ? 'Content must be at least 10 characters' : null),
      forumThreadTitle: (value, values) =>
        values.createForumThread && (!value || !value.trim())
          ? 'Forum thread title is required when creating a thread'
          : null,
    },
  });

  const handleSubmit = async (values: BlogEntryFormData) => {
    try {
      await onSubmit(values);
      form.reset();
    } catch (error) {
      console.error('Failed to submit:', error);
    }
  };

  return (
    <Paper shadow="sm" p="xl" withBorder>
      <Title order={2} mb="lg">
        Create New Entry {orgName && `for ${orgName}`}
      </Title>

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          {/* Title */}
          <TextInput
            label="Title"
            placeholder="Enter post title"
            required
            {...form.getInputProps('title')}
          />

          {/* Excerpt (optional preview text) */}
          <Textarea
            label="Excerpt"
            placeholder="Short summary (optional)"
            minRows={2}
            {...form.getInputProps('excerpt')}
          />

          {/* Rich Text Body */}
          <div>
            <label style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px', display: 'block' }}>
              Content *
            </label>
            <RichTextEditor
              content={form.values.body}
              onChange={(value) => form.setFieldValue('body', value)}
            />
            {form.errors.body && (
              <div style={{ color: 'var(--mantine-color-error)', fontSize: '12px', marginTop: '4px' }}>
                {form.errors.body}
              </div>
            )}
          </div>

          {/* Link (optional external URL) */}
          <TextInput
            label="Link"
            placeholder="https://example.com (optional)"
            {...form.getInputProps('link')}
          />

          {/* Media Upload */}
          <MediaUpload
            files={form.values.media}
            onChange={(files) => form.setFieldValue('media', files)}
          />

          {/* Tags */}
          <TagsInput
            label="Tags"
            placeholder="Add tags"
            data={[]} // Can be populated with suggested tags
            {...form.getInputProps('tags')}
          />

          {/* Forum Thread Option */}
          <Paper p="md" withBorder>
            <Stack gap="sm">
              <Switch
                label="Create forum thread"
                description="Share this post to the community forum"
                {...form.getInputProps('createForumThread', { type: 'checkbox' })}
              />

              {form.values.createForumThread && (
                <TextInput
                  label="Forum Thread Title"
                  placeholder="Custom title for forum (or leave blank to use post title)"
                  {...form.getInputProps('forumThreadTitle')}
                />
              )}
            </Stack>
          </Paper>

          {/* Submit */}
          <Group justify="flex-end" mt="md">
            <Button
              type="button"
              variant="light"
              onClick={() => form.reset()}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
              {submitLabel}
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}
