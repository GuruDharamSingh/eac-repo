"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin, Video, User, FileText, ExternalLink } from "lucide-react";
import type { Meeting } from "@elkdonis/types";
import { formatDate, formatTime } from "@/lib/utils";
import { MediaPlayer, DocumentLink } from "@elkdonis/ui";
import Image from "next/image";

interface MeetingCardProps {
  meeting: Meeting;
}

export function MeetingCard({ meeting }: MeetingCardProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const guideName = meeting.guide?.displayName || meeting.creator?.displayName || "Unknown";
  const coverImageId = meeting.coverImage?.id;
  const attachments = (meeting.media || []).filter((media) => media.id !== coverImageId);
  const nextcloudUrl = process.env.NEXT_PUBLIC_NEXTCLOUD_URL || 'http://localhost:8080';

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      {/* Cover Image */}
      {meeting.coverImage?.url && (
        <div className="relative h-48 w-full overflow-hidden bg-muted">
          <Image
            src={meeting.coverImage.url}
            alt={meeting.coverImage.altText || meeting.title}
            fill
            className="object-cover"
          />
        </div>
      )}

      <CardHeader className="space-y-3 pb-4">
        {/* Title & Badges */}
        <div className="space-y-2">
          <h3 className="text-xl font-semibold leading-tight">{meeting.title}</h3>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Meeting</Badge>
            {meeting.isOnline && (
              <Badge variant="secondary" className="bg-cyan-100 text-cyan-900 dark:bg-cyan-900 dark:text-cyan-100">
                <Video className="h-3 w-3 mr-1" />
                Online
              </Badge>
            )}
          </div>
        </div>

        {/* Description */}
        {meeting.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {meeting.description}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        {/* Date & Time */}
        {meeting.scheduledAt && mounted && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4 text-indigo-600" />
              <span className="font-medium text-foreground">{formatDate(new Date(meeting.scheduledAt))}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4 text-indigo-600" />
              <span>
                {formatTime(new Date(meeting.scheduledAt))}
                {meeting.durationMinutes && <span className="text-xs ml-1">({meeting.durationMinutes}m)</span>}
              </span>
            </div>
          </div>
        )}

        {/* Location */}
        {meeting.location && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4 text-indigo-600" />
            <span>{meeting.location}</span>
          </div>
        )}

        {/* Guide */}
        <div className="flex items-center gap-2 text-muted-foreground">
          <User className="h-4 w-4 text-indigo-600" />
          <span>Guide: <span className="font-medium text-foreground">{guideName}</span></span>
        </div>

        {/* Media Attachments */}
        {attachments.length > 0 && (
          <div className="space-y-2 pt-2">
            <h4 className="font-medium text-xs uppercase text-muted-foreground">Media</h4>
            <div className="space-y-2">
              {attachments.map((media) => {
                const mediaType = media.type || media.mimeType?.split("/")[0];

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

                return (
                  <a
                    key={media.id}
                    href={media.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs hover:text-indigo-600 transition-colors"
                  >
                    <FileText className="h-3 w-3" />
                    <span className="truncate">{media.filename || "Download"}</span>
                    <ExternalLink className="h-3 w-3 ml-auto" />
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>

      {/* Actions Footer */}
      {(meeting.nextcloudTalkToken || meeting.documentUrl) && (
        <CardFooter className="flex flex-col gap-2 pt-4 border-t">
          {meeting.nextcloudTalkToken && (
            <Button asChild className="w-full" size="sm">
              <a
                href={`${nextcloudUrl}/call/${meeting.nextcloudTalkToken}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Video className="h-4 w-4 mr-2" />
                Join Talk Room
              </a>
            </Button>
          )}

          {meeting.documentUrl && (
            <Button asChild variant="outline" className="w-full" size="sm">
              <a
                href={meeting.documentUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileText className="h-4 w-4 mr-2" />
                Living Document
              </a>
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
