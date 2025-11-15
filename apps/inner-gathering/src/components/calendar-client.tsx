"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MeetingCalendar } from "./calendar/meeting-calendar";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Calendar as CalendarIcon, Plus, ExternalLink, MapPin, Video, Clock, User, FileText } from "lucide-react";
import type { Meeting } from "@elkdonis/types";
import { format } from "date-fns";
import { Badge } from "./ui/badge";

interface CalendarClientProps {
  initialMeetings: Meeting[];
}

export function CalendarClient({ initialMeetings }: CalendarClientProps) {
  const router = useRouter();
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const nextcloudUrl = process.env.NEXT_PUBLIC_NEXTCLOUD_URL || 'http://localhost:8080';

  const handleSelectMeeting = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setDrawerOpen(true);
  };

  const handleCreateMeeting = () => {
    router.push("/feed?create=meeting");
  };

  const meetingDate = selectedMeeting?.scheduledAt
    ? new Date(selectedMeeting.scheduledAt)
    : selectedMeeting?.startTime;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CalendarIcon className="h-8 w-8 text-indigo-600" />
            Community Calendar
          </h1>
          <p className="text-muted-foreground mt-2">
            View and manage all community events and gatherings
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href={`${nextcloudUrl}/apps/calendar`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Nextcloud
            </a>
          </Button>
          <Button onClick={handleCreateMeeting}>
            <Plus className="h-4 w-4 mr-2" />
            Create Meeting
          </Button>
        </div>
      </div>

      {/* Calendar Component */}
      <MeetingCalendar
        meetings={initialMeetings}
        onSelectMeeting={handleSelectMeeting}
      />

      {/* Meeting Details Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle>{selectedMeeting?.title}</DrawerTitle>
          </DrawerHeader>
          {selectedMeeting && (
            <div className="px-4 pb-6 space-y-4 max-w-2xl">
              {/* Status Badge */}
              <div className="flex items-center gap-2">
                {selectedMeeting.isOnline && (
                  <Badge variant="secondary">
                    <Video className="h-3 w-3 mr-1" />
                    Online
                  </Badge>
                )}
                <Badge variant="outline">{selectedMeeting.status}</Badge>
              </div>

              {/* Date & Time */}
              {meetingDate && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{format(meetingDate, "EEEE, MMMM d, yyyy 'at' h:mm a")}</span>
                  {selectedMeeting.durationMinutes && (
                    <span className="text-muted-foreground">
                      ({selectedMeeting.durationMinutes} minutes)
                    </span>
                  )}
                </div>
              )}

              {/* Location */}
              {selectedMeeting.location && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedMeeting.location}</span>
                </div>
              )}

              {/* Guide */}
              {selectedMeeting.guide && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>Guide: {selectedMeeting.guide.displayName}</span>
                </div>
              )}

              {/* Description */}
              {selectedMeeting.description && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Description</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedMeeting.description}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-4">
                {selectedMeeting.nextcloudTalkToken && (
                  <Button asChild className="w-full">
                    <a
                      href={`${nextcloudUrl}/call/${selectedMeeting.nextcloudTalkToken}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Video className="h-4 w-4 mr-2" />
                      Join Talk Room
                    </a>
                  </Button>
                )}

                {selectedMeeting.documentUrl && (
                  <Button variant="outline" asChild className="w-full">
                    <a
                      href={selectedMeeting.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      View Document
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
