import type { MeetingVisibility } from "@elkdonis/types";

export const VISIBILITY_OPTIONS: { value: MeetingVisibility; label: string }[] = [
  { value: "ORGANIZATION", label: "Organization Only" },
  { value: "PUBLIC", label: "Public" },
  { value: "INVITE_ONLY", label: "Invite Only" },
];

export const DEFAULT_MEETING_DURATION = 60; // minutes

export const NEXTCLOUD_DEFAULT_URL = 'http://localhost:8080';

export const POLL_INTERVAL = 5000; // milliseconds for polling updates