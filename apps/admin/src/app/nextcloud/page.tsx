'use client';

import {
  Container,
  Title,
  Text,
  Stack,
} from '@mantine/core';
import { FileBrowser } from '@elkdonis/ui';

export default function NextcloudPage() {
  const orgId = 'elkdonis';

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        <div>
          <Title order={2}>Nextcloud Integration</Title>
          <Text c="dimmed" size="sm">
            Browse and manage your organization&apos;s shared files
          </Text>
        </div>

        <FileBrowser
          orgId={orgId}
          onFileSelect={(file) => console.log('Selected file:', file)}
        />
      </Stack>
    </Container>
  );
}
