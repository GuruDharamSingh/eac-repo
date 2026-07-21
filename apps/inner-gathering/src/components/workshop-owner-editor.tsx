"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Drawer,
  Group,
  NumberInput,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { Pencil } from "lucide-react";
import { SingleImageField } from "@elkdonis/ui";

// ============================================================================
// Owner-only inline editor for the workshop detail page's media slots and
// basics. PATCHes /api/workshops/[id]. Images can be uploaded or picked from
// the org's Nextcloud library via SingleImageField.
// ============================================================================

interface OwnerEditorProps {
  workshopId: string;
  initial: {
    title: string;
    price?: number;
    bannerImageUrl: string | null;
    heroMediaUrl: string | null;
    heroMediaType: "image" | "video" | null;
    coverImageUrl: string | null;
  };
}

export function WorkshopOwnerEditor({ workshopId, initial }: OwnerEditorProps) {
  const router = useRouter();
  const [opened, setOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(initial.title);
  const [price, setPrice] = useState<number | string>(initial.price ?? "");
  const [banner, setBanner] = useState(initial.bannerImageUrl ?? "");
  const [hero, setHero] = useState(initial.heroMediaUrl ?? "");
  const [heroType, setHeroType] = useState<"image" | "video">(initial.heroMediaType ?? "image");
  const [cover, setCover] = useState(initial.coverImageUrl ?? "");

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/workshops/${workshopId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || undefined,
          price: price === "" ? undefined : Number(price),
          bannerImageUrl: banner.trim() || null,
          heroMediaUrl: hero.trim() || null,
          heroMediaType: hero.trim() ? heroType : null,
          coverImageUrl: cover.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Save failed (${res.status})`);
      }
      setOpened(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        variant="light"
        color="orange"
        size="xs"
        leftSection={<Pencil size={13} />}
        onClick={() => setOpened(true)}
      >
        Edit page
      </Button>

      <Drawer
        opened={opened}
        onClose={() => setOpened(false)}
        position="bottom"
        size="80%"
        title={
          <div>
            <Title order={4}>Edit workshop page</Title>
            <Text size="sm" c="dimmed">
              Media slots and basics — content and sessions are edited from My Offerings.
            </Text>
          </div>
        }
      >
        <Stack gap="md" pb="xl">
          {error && (
            <Text c="red" size="sm">
              {error}
            </Text>
          )}

          <TextInput
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
          />
          <NumberInput
            label="Price"
            prefix="$"
            min={0}
            value={price}
            onChange={setPrice}
          />

          <Paper withBorder p="md" radius="md">
            <Stack gap="md">
              <Text fw={600} size="sm">
                Media slots
              </Text>
              <SingleImageField
                label="Banner image"
                description="Wide image behind the title at the top of the page"
                value={banner}
                onChange={(url) => setBanner(url ?? "")}
                orgId="inner_group"
              />
              <Stack gap={4}>
                <SegmentedControl
                  value={heroType}
                  onChange={(v) => setHeroType(v as "image" | "video")}
                  data={[
                    { label: "Hero image", value: "image" },
                    { label: "Hero video", value: "video" },
                  ]}
                  w={260}
                />
                {heroType === "video" ? (
                  <TextInput
                    label="Main media (hero) — video URL"
                    description="Video URL (mp4 or hosted embed) shown in the page body"
                    placeholder="https://…"
                    value={hero}
                    onChange={(e) => setHero(e.currentTarget.value)}
                  />
                ) : (
                  <SingleImageField
                    label="Main media (hero)"
                    description="Featured image shown in the page body"
                    value={hero}
                    onChange={(url) => setHero(url ?? "")}
                    orgId="inner_group"
                  />
                )}
              </Stack>
              <SingleImageField
                label="Card thumbnail"
                description="Shown on feed and workshop cards (cover image)"
                value={cover}
                onChange={(url) => setCover(url ?? "")}
                orgId="inner_group"
              />
            </Stack>
          </Paper>

          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setOpened(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              Save changes
            </Button>
          </Group>
        </Stack>
      </Drawer>
    </>
  );
}
