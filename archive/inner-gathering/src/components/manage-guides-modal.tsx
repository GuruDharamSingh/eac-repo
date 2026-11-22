"use client";

import { useEffect, useState } from "react";
import {
  Modal,
  MultiSelect,
  Button,
  Group,
  Text,
  Stack,
  Loader,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";

interface Member {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

// Lets the meeting author/admin add co-guides who can also confirm/cancel the
// meeting and appear in the shared confirmation count.
export function ManageGuidesModal({
  meetingId,
  opened,
  onClose,
  onSaved,
}: {
  meetingId: string;
  opened: boolean;
  onClose: () => void;
  onSaved?: (coGuideIds: string[]) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!opened) return;
    setLoading(true);
    fetch(`/api/meetings/${meetingId}/guides`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setMembers(data.members || []);
        setSelected(data.coGuideIds || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [opened, meetingId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/guides`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coGuideIds: selected }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      notifications.show({ color: "teal", message: "Guides updated" });
      onSaved?.(data.coGuideIds || selected);
      onClose();
    } catch {
      notifications.show({ color: "red", message: "Could not update guides" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Manage guides" centered size="md">
      {loading ? (
        <Group justify="center" py="lg">
          <Loader size="sm" />
        </Group>
      ) : (
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Co-guides can confirm or cancel this meeting. One guide confirming is
            enough to light the badge — the others count as going.
          </Text>
          <MultiSelect
            label="Co-guides"
            placeholder="Add members…"
            data={members.map((m) => ({ value: m.id, label: m.name }))}
            value={selected}
            onChange={setSelected}
            searchable
            clearable
            nothingFoundMessage="No members found"
          />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={onClose}>
              Cancel
            </Button>
            <Button color="ember" loading={saving} onClick={handleSave}>
              Save
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
