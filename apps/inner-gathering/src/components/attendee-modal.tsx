"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Avatar,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Loader,
  Modal,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import { UserCheck, UserX, UserPlus, Users, Clock } from "lucide-react";
import type { Meeting } from "@elkdonis/types";
import { useRealtimeAttendees } from "@elkdonis/hooks";
import { supabase } from "@/lib/supabase";

interface Attendee {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  status: "registered" | "attended" | "absent";
  registeredAt: string;
}

interface AttendeeModalProps {
  meeting: Meeting | null;
  opened: boolean;
  onClose: () => void;
}

export function AttendeeModal({ meeting, opened, onClose }: AttendeeModalProps) {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [summary, setSummary] = useState({ registered: 0, attended: 0, absent: 0 });
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  
  // Current user's RSVP status
  const [myRsvpStatus, setMyRsvpStatus] = useState<string | null>(null);
  const [isAttending, setIsAttending] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState(false);

  const isPastMeeting = meeting?.scheduledAt && new Date(meeting.scheduledAt) < new Date();

  // Realtime attendee changes - refetch when someone joins/leaves
  const { recentChanges } = useRealtimeAttendees({
    client: supabase,
    meetingId: meeting?.id || '',
    enabled: opened && !!meeting,
  });

  useEffect(() => {
    if (opened && meeting) {
      fetchAttendees();
      checkMyRsvpStatus();
    }
  }, [opened, meeting?.id]);

  // Refetch when realtime changes occur
  useEffect(() => {
    if (opened && meeting && recentChanges.length > 0) {
      fetchAttendees();
    }
  }, [recentChanges.length]);

  const checkMyRsvpStatus = async () => {
    if (!meeting) return;
    try {
      const res = await fetch(`/api/meetings/${meeting.id}/rsvp`);
      if (res.ok) {
        const data = await res.json();
        setIsAttending(data.attending);
        setMyRsvpStatus(data.status);
      }
    } catch (error) {
      console.error("Error checking RSVP status:", error);
    }
  };

  const handleRsvp = async (shouldAttend: boolean) => {
    if (!meeting || shouldAttend === isAttending) return;
    setRsvpLoading(true);
    try {
      if (!shouldAttend) {
        const res = await fetch(`/api/meetings/${meeting.id}/rsvp`, { method: "DELETE" });
        if (res.ok) {
          setIsAttending(false);
          setMyRsvpStatus(null);
          fetchAttendees(); // Refresh the list
        }
      } else {
        const res = await fetch(`/api/meetings/${meeting.id}/rsvp`, { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          setIsAttending(true);
          setMyRsvpStatus(data.status);
          fetchAttendees(); // Refresh the list
        }
      }
    } catch (error) {
      console.error("Error updating RSVP:", error);
    } finally {
      setRsvpLoading(false);
    }
  };

  const fetchAttendees = async () => {
    if (!meeting) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/meetings/${meeting.id}/attendees`);
      if (res.ok) {
        const data = await res.json();
        setAttendees(data.attendees);
        setSummary(data.summary);
      }
    } catch (error) {
      console.error("Error fetching attendees:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateAttendeeStatus = async (userId: string, status: string) => {
    if (!meeting) return;
    try {
      const res = await fetch(`/api/meetings/${meeting.id}/attendees`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, status }),
      });
      if (res.ok) {
        // Refresh attendee list
        fetchAttendees();
      }
    } catch (error) {
      console.error("Error updating attendee status:", error);
    }
  };

  const filteredAttendees = attendees.filter((a) => {
    if (filter === "all") return true;
    return a.status === filter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "attended":
        return <Badge size="sm" color="teal" leftSection={<UserCheck size={10} />}>Attended</Badge>;
      case "absent":
        return <Badge size="sm" color="red" leftSection={<UserX size={10} />}>Absent</Badge>;
      default:
        return <Badge size="sm" color="blue" leftSection={<Clock size={10} />}>Registered</Badge>;
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <ThemeIcon variant="light" color="indigo" size="sm">
            <Users size={14} />
          </ThemeIcon>
          <Text fw={600}>{isPastMeeting ? "Attendance Report" : "Attendees"}</Text>
        </Group>
      }
      size="md"
    >
      {loading ? (
        <Box py="xl" ta="center">
          <Loader size="sm" />
        </Box>
      ) : (
        <Stack gap="md">
          {/* Your RSVP Section */}
          <Paper withBorder p="md" radius="md" bg="gray.0">
            <Stack gap="sm">
              <Text size="sm" fw={600}>Your RSVP</Text>
              <Group grow gap="xs">
                <Button
                  size="sm"
                  variant={isAttending ? "filled" : "light"}
                  color="teal"
                  leftSection={isAttending ? <UserCheck size={16} /> : <UserPlus size={16} />}
                  onClick={() => handleRsvp(true)}
                  loading={rsvpLoading}
                >
                  {isAttending ? "I'm Going ✓" : "I'm Going"}
                </Button>
                <Button
                  size="sm"
                  variant={!isAttending && myRsvpStatus === null ? "light" : isAttending ? "light" : "filled"}
                  color="gray"
                  leftSection={<UserX size={16} />}
                  onClick={() => handleRsvp(false)}
                  loading={rsvpLoading}
                  disabled={!isAttending}
                >
                  Cancel RSVP
                </Button>
              </Group>
              {isAttending && (
                <Text size="xs" c="teal">
                  You're registered for this meeting
                </Text>
              )}
            </Stack>
          </Paper>

          <Divider />

          {/* Summary */}
          <Group gap="md" justify="center">
            <Stack gap={2} align="center">
              <Text size="xl" fw={700} c="blue">{summary.registered}</Text>
              <Text size="xs" c="dimmed">Registered</Text>
            </Stack>
            {isPastMeeting && (
              <>
                <Stack gap={2} align="center">
                  <Text size="xl" fw={700} c="teal">{summary.attended}</Text>
                  <Text size="xs" c="dimmed">Attended</Text>
                </Stack>
                <Stack gap={2} align="center">
                  <Text size="xl" fw={700} c="red">{summary.absent}</Text>
                  <Text size="xs" c="dimmed">Absent</Text>
                </Stack>
              </>
            )}
          </Group>

          {/* Filter (for past meetings with attendance marked) */}
          {isPastMeeting && attendees.length > 0 && (
            <SegmentedControl
              value={filter}
              onChange={setFilter}
              data={[
                { label: "All", value: "all" },
                { label: "Attended", value: "attended" },
                { label: "Absent", value: "absent" },
                { label: "Registered", value: "registered" },
              ]}
              size="xs"
              fullWidth
            />
          )}

          {/* Attendee List */}
          {filteredAttendees.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="md">
              No attendees yet
            </Text>
          ) : (
            <Stack gap="xs">
              {filteredAttendees.map((attendee) => (
                <Group key={attendee.userId} justify="space-between" p="xs" bg="gray.0" style={{ borderRadius: 8 }}>
                  <Group gap="sm">
                    <Avatar src={attendee.avatarUrl} size="sm" radius="xl">
                      {attendee.displayName?.charAt(0)?.toUpperCase()}
                    </Avatar>
                    <Text size="sm" fw={500}>{attendee.displayName}</Text>
                  </Group>

                  {isPastMeeting ? (
                    <Group gap="xs">
                      {getStatusBadge(attendee.status)}
                      {/* Quick status toggle for past meetings */}
                      {attendee.status === "registered" && (
                        <Group gap={4}>
                          <Button
                            size="compact-xs"
                            variant="light"
                            color="teal"
                            onClick={() => updateAttendeeStatus(attendee.userId, "attended")}
                          >
                            ✓
                          </Button>
                          <Button
                            size="compact-xs"
                            variant="light"
                            color="red"
                            onClick={() => updateAttendeeStatus(attendee.userId, "absent")}
                          >
                            ✗
                          </Button>
                        </Group>
                      )}
                    </Group>
                  ) : (
                    getStatusBadge(attendee.status)
                  )}
                </Group>
              ))}
            </Stack>
          )}
        </Stack>
      )}
    </Modal>
  );
}
