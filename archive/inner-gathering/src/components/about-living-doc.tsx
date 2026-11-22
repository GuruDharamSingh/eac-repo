"use client";

import { useState } from "react";
import { Box, Button, Group, Paper, Stack, Text, Anchor } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { ExternalLink, FilePlus2, Pencil } from "lucide-react";

export interface AboutDocument {
  fileId: string;
  url: string;
  editUrl: string;
  shareToken: string;
  createdAt: string;
}

// Renders the About living document, served from Nextcloud as an embedded
// public share. Admins can create it (if none exists yet) or jump to Nextcloud
// to edit; edits there show up in the embed for everyone.
export function AboutLivingDoc({
  document,
  isAdmin = false,
}: {
  document: AboutDocument | null;
  isAdmin?: boolean;
}) {
  const [doc, setDoc] = useState<AboutDocument | null>(document);
  const [creating, setCreating] = useState(false);

  const createDoc = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/about-document", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json();
      if (!res.ok || !data.document) throw new Error(data.error || "Failed");
      setDoc(data.document);
      notifications.show({ color: "teal", message: "About document created in Nextcloud" });
    } catch (e) {
      notifications.show({ color: "red", message: e instanceof Error ? e.message : "Could not create document" });
    } finally {
      setCreating(false);
    }
  };

  if (!doc) {
    return (
      <Paper withBorder radius="md" p="xl" maw={620} mx="auto" ta="center">
        <Stack gap="sm" align="center">
          <Text fw={600} size="lg">Our story is being written.</Text>
          <Text size="sm" c="dimmed">
            This page is a living document kept in our Nextcloud. Check back soon.
          </Text>
          {isAdmin && (
            <Button
              mt="sm"
              color="ember"
              leftSection={<FilePlus2 size={16} />}
              loading={creating}
              onClick={createDoc}
            >
              Create the About document
            </Button>
          )}
        </Stack>
      </Paper>
    );
  }

  return (
    <Stack gap="sm">
      <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
        <Box
          component="iframe"
          src={doc.url}
          title="About — living document"
          loading="lazy"
          style={{ width: "100%", height: "78vh", border: "none", display: "block" }}
        />
      </Paper>

      <Group justify="space-between" gap="sm">
        <Text size="xs" c="dimmed">
          If the document doesn&apos;t load,{" "}
          <Anchor href={doc.url} target="_blank" rel="noopener noreferrer" size="xs">
            open it in a new tab
          </Anchor>
          .
        </Text>
        {isAdmin && (
          <Button
            component="a"
            href={doc.editUrl}
            target="_blank"
            rel="noopener noreferrer"
            size="xs"
            variant="light"
            color="ember"
            leftSection={<Pencil size={14} />}
            rightSection={<ExternalLink size={13} />}
          >
            Edit in Nextcloud
          </Button>
        )}
      </Group>
    </Stack>
  );
}
