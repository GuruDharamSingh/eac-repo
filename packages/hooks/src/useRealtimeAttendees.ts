import { useState, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useRealtimeSubscription } from './useRealtimeSubscription';

interface AttendeeChange {
  meetingId: string;
  userId: string;
  type: 'join' | 'leave' | 'status_change';
  status?: string;
  timestamp: Date;
}

interface UseRealtimeAttendeesOptions {
  client: SupabaseClient;
  meetingId: string;
  enabled?: boolean;
}

export function useRealtimeAttendees({
  client,
  meetingId,
  enabled = true,
}: UseRealtimeAttendeesOptions) {
  const [attendeeCount, setAttendeeCount] = useState<number | null>(null);
  const [recentChanges, setRecentChanges] = useState<AttendeeChange[]>([]);

  const addChange = useCallback((change: AttendeeChange) => {
    setRecentChanges((prev) => [change, ...prev].slice(0, 10));
  }, []);

  // Listen for new RSVPs
  useRealtimeSubscription<Record<string, unknown>>({
    client,
    table: 'meeting_attendees',
    event: 'INSERT',
    filter: `meeting_id=eq.${meetingId}`,
    onInsert: (payload) => {
      setAttendeeCount((prev) => (prev !== null ? prev + 1 : null));
      addChange({
        meetingId: payload.meeting_id as string,
        userId: payload.user_id as string,
        type: 'join',
        status: payload.attendance_status as string,
        timestamp: new Date(),
      });
    },
    enabled,
  });

  // Listen for RSVP cancellations
  useRealtimeSubscription<Record<string, unknown>>({
    client,
    table: 'meeting_attendees',
    event: 'DELETE',
    filter: `meeting_id=eq.${meetingId}`,
    onDelete: (payload) => {
      setAttendeeCount((prev) => (prev !== null && prev > 0 ? prev - 1 : null));
      addChange({
        meetingId: payload.meeting_id as string,
        userId: payload.user_id as string,
        type: 'leave',
        timestamp: new Date(),
      });
    },
    enabled,
  });

  // Listen for attendance status changes
  useRealtimeSubscription<Record<string, unknown>>({
    client,
    table: 'meeting_attendees',
    event: 'UPDATE',
    filter: `meeting_id=eq.${meetingId}`,
    onUpdate: ({ new: newRow }) => {
      addChange({
        meetingId: newRow.meeting_id as string,
        userId: newRow.user_id as string,
        type: 'status_change',
        status: newRow.attendance_status as string,
        timestamp: new Date(),
      });
    },
    enabled,
  });

  const initializeCount = useCallback((count: number) => {
    setAttendeeCount(count);
  }, []);

  return {
    attendeeCount,
    recentChanges,
    initializeCount,
  };
}
