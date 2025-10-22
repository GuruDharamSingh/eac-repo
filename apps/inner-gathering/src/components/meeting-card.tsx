import { Paper, Text, Group, Stack, Badge, ThemeIcon, Image, Anchor } from "@mantine/core";
import { Calendar, Clock, MapPin, Video, User, Music4, Film, FileText, Image as ImageIcon } from "lucide-react";
import type { Meeting } from "@elkdonis/types";
import { formatDate, formatTime } from "@/lib/utils";
import { MediaPlayer, DocumentLink } from "@elkdonis/ui";

interface MeetingCardProps {
  meeting: Meeting;
}

export function MeetingCard({ meeting }: MeetingCardProps) {
  const guideName = meeting.guide?.displayName || meeting.creator?.displayName || "Unknown";
  const coverImageId = meeting.coverImage?.id;
  const attachments = (meeting.media || []).filter((media) => media.id !== coverImageId);

  const renderAttachmentIcon = (type?: string) => {
    switch (type) {
      case "audio":
        return <Music4 size={14} />;
      case "video":
        return <Film size={14} />;
      case "image":
        return <ImageIcon size={14} />;
      default:
        return <FileText size={14} />;
    }
  };

  return (
    <Paper withBorder radius="lg" p="md" shadow="sm">
      <Stack gap="sm">
        {meeting.coverImage?.url && (
          <Image
            src={meeting.coverImage.url}
            alt={meeting.coverImage.altText || meeting.title}
            radius="md"
            h={200}
            fit="cover"
          />
        )}
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Text fw={600} size="lg">
              {meeting.title}
            </Text>
            <Group gap="xs">
              <Badge variant="light" color="indigo" size="sm">
                Meeting
              </Badge>
              {meeting.isOnline && (
                <Badge variant="light" color="cyan" leftSection={<Video size={12} />} size="sm">
                  Online
                </Badge>
              )}
            </Group>
          </Stack>
        </Group>

        {meeting.description && (
          <Text size="sm" c="dimmed" lineClamp={2}>
            {meeting.description}
          </Text>
        )}

        <Stack gap={6}>
          {meeting.startTime && (
            <>
              <Group gap="xs">
                <ThemeIcon size="sm" radius="md" variant="light">
                  <Calendar size={14} />
                </ThemeIcon>
                <Text size="sm">{formatDate(new Date(meeting.startTime))}</Text>
              </Group>
              <Group gap="xs">
                <ThemeIcon size="sm" radius="md" variant="light">
                  <Clock size={14} />
                </ThemeIcon>
                <Text size="sm">
                  {formatTime(new Date(meeting.startTime))}
                  {meeting.endTime && ` - ${formatTime(new Date(meeting.endTime))}`}
                  {meeting.durationMinutes && ` (${meeting.durationMinutes} min)`}
                </Text>
              </Group>
            </>
          )}
          {meeting.location && (
            <Group gap="xs">
              <ThemeIcon size="sm" radius="md" variant="light">
                <MapPin size={14} />
              </ThemeIcon>
              <Text size="sm">{meeting.location}</Text>
            </Group>
          )}
          <Group gap="xs">
            <ThemeIcon size="sm" radius="md" variant="light">
              <User size={14} />
            </ThemeIcon>
            <Text size="sm">Guide: {guideName}</Text>
          </Group>

          {attachments.length > 0 && (
            <Stack gap={8}>
              <Text size="sm" fw={500}>
                Media
              </Text>
              <Stack gap={8}>
                {attachments.map((media) => {
                  const mediaType = media.type || media.mimeType?.split("/")[0];
                  
                  // Render inline media player for video, audio, and images
                  if (mediaType === "video" || mediaType === "audio" || mediaType === "image") {
                    return (
                      <MediaPlayer
                        key={media.id}
                        url={media.url}
                        type={mediaType as "video" | "audio" | "image"}
                        title={media.filename}
                      />
                    );
                  }
                  
                  // Fallback to link for other file types
                  return (
                    <Group key={media.id} gap="xs">
                      <ThemeIcon size="sm" radius="md" variant="outline" color="gray">
                        {renderAttachmentIcon(mediaType)}
                      </ThemeIcon>
                      <Anchor href={media.url} target="_blank" size="sm">
                        {media.filename || media.url.split("/").pop() || "Download"}
                      </Anchor>
                      <Text size="xs" c="dimmed">
                        {media.mimeType?.split("/")[0] ?? "file"}
                      </Text>
                    </Group>
                  );
                })}
              </Stack>
            </Stack>
          )}
        </Stack>

        {meeting.documentUrl && (
          <DocumentLink
            documentUrl={meeting.documentUrl}
            title="📄 Living Document"
          />
        )}
      </Stack>
    </Paper>
  );
}
