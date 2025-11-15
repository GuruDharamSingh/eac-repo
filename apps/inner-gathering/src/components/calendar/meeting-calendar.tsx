"use client";

import * as React from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar as CalendarIcon, MapPin, Video, Clock } from "lucide-react";
import type { Meeting } from "@elkdonis/types";
import { format, isSameDay, startOfMonth, endOfMonth, addMonths } from "date-fns";

interface MeetingCalendarProps {
  meetings: Meeting[];
  onSelectDate?: (date: Date) => void;
  onSelectMeeting?: (meeting: Meeting) => void;
}

export function MeetingCalendar({
  meetings,
  onSelectDate,
  onSelectMeeting
}: MeetingCalendarProps) {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(new Date());
  const [currentMonth, setCurrentMonth] = React.useState<Date>(new Date());

  // Get meetings for selected date
  const selectedDateMeetings = React.useMemo(() => {
    if (!selectedDate) return [];
    return meetings.filter((meeting) => {
      const meetingDate = meeting.scheduledAt ? new Date(meeting.scheduledAt) : meeting.startTime;
      return meetingDate && isSameDay(meetingDate, selectedDate);
    });
  }, [meetings, selectedDate]);

  // Get dates that have meetings
  const meetingDates = React.useMemo(() => {
    return meetings.map((meeting) => {
      const date = meeting.scheduledAt ? new Date(meeting.scheduledAt) : meeting.startTime;
      return date;
    }).filter(Boolean) as Date[];
  }, [meetings]);

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date && onSelectDate) {
      onSelectDate(date);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 w-full">
      {/* Calendar */}
      <Card className="lg:w-2/3">
        <CardContent className="p-4">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            className="rounded-md border-0"
            captionLayout="dropdown"
            modifiers={{
              hasMeeting: meetingDates,
            }}
            modifiersClassNames={{
              hasMeeting: "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full after:bg-indigo-600",
            }}
          />
        </CardContent>
      </Card>

      {/* Selected Date Events */}
      <Card className="lg:w-1/3">
        <CardContent className="p-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-indigo-600" />
              <h3 className="font-semibold">
                {selectedDate ? format(selectedDate, "MMMM d, yyyy") : "Select a date"}
              </h3>
            </div>

            {selectedDateMeetings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No meetings scheduled for this day
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {selectedDateMeetings.map((meeting) => (
                    <CalendarEventCard
                      key={meeting.id}
                      meeting={meeting}
                      onClick={() => onSelectMeeting?.(meeting)}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface CalendarEventCardProps {
  meeting: Meeting;
  onClick?: () => void;
}

function CalendarEventCard({ meeting, onClick }: CalendarEventCardProps) {
  const meetingDate = meeting.scheduledAt ? new Date(meeting.scheduledAt) : meeting.startTime;
  const time = meetingDate ? format(meetingDate, "h:mm a") : "Time TBA";

  return (
    <div
      onClick={onClick}
      className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-sm line-clamp-1">{meeting.title}</h4>
          {meeting.isOnline && (
            <Badge variant="secondary" className="shrink-0">
              <Video className="h-3 w-3 mr-1" />
              Online
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {time}
          </div>
          {meeting.durationMinutes && (
            <span>{meeting.durationMinutes} min</span>
          )}
        </div>

        {meeting.location && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {meeting.location}
          </div>
        )}

        {meeting.guide && (
          <div className="text-xs text-muted-foreground">
            Guide: {meeting.guide.displayName}
          </div>
        )}
      </div>
    </div>
  );
}
