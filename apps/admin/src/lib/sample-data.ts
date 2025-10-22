import { Meeting, Organization, RSVP, User } from "@elkdonis/types";

export const sampleOrganizations: Organization[] = [
  {
    id: "org-eac",
    name: "ELKDonis Arts Collective",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-09-20"),
  },
  {
    id: "org-amrit",
    name: "Amrit Canada",
    createdAt: new Date("2024-02-01"),
    updatedAt: new Date("2024-09-21"),
  },
  {
    id: "org-book",
    name: "Book Readers",
    createdAt: new Date("2024-03-01"),
    updatedAt: new Date("2024-09-22"),
  },
];

export const sampleUsers: User[] = [
  {
    id: "user-1",
    name: "John Doe",
    email: "john@example.com",
    avatarUrl:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
    isSuperadmin: true,
    createdAt: new Date("2024-01-15"),
    updatedAt: new Date("2024-09-20"),
  },
  {
    id: "user-2",
    name: "Jane Smith",
    email: "jane@example.com",
    avatarUrl:
      "https://images.unsplash.com/photo-1494790108755-2616b612345e?w=150&h=150&fit=crop&crop=face",
    isSuperadmin: false,
    createdAt: new Date("2024-02-10"),
    updatedAt: new Date("2024-09-18"),
  },
  {
    id: "user-3",
    name: "Mike Johnson",
    email: "mike@example.com",
    avatarUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
    isSuperadmin: false,
    createdAt: new Date("2024-03-05"),
    updatedAt: new Date("2024-09-15"),
  },
  {
    id: "user-4",
    name: "Sarah Wilson",
    email: "sarah@example.com",
    isSuperadmin: false,
    createdAt: new Date("2024-08-20"),
    updatedAt: new Date("2024-09-22"),
  },
];

export const sampleMeetings: Meeting[] = [
  {
    id: "meeting-1",
    title: "Weekly Standup",
    description: "Our weekly team standup to discuss progress and blockers",
    startTime: new Date("2024-09-26T09:00:00"),
    endTime: new Date("2024-09-26T10:00:00"),
    orgId: "org-eac",
    createdBy: "user-1",
    videoLink: "https://zoom.us/j/123456789",
    isRSVPEnabled: true,
    location: "HQ Conference Room 1",
    timeZone: "America/New_York",
    recurrencePattern: "WEEKLY",
    recurrenceCustomRule: undefined,
    reminderMinutesBefore: 15,
    coHostIds: ["user-2"],
    rsvpDeadline: new Date("2024-09-25T17:00:00"),
    visibility: "ORGANIZATION",
    autoRecord: false,
    tags: ["standup", "team"],
    attachments: ["https://docs.example.com/standup-notes"],
    followUpWorkflow: true,
    createdAt: new Date("2024-09-20"),
    updatedAt: new Date("2024-09-25"),
  },
  {
    id: "meeting-2",
    title: "Product Planning Session",
    description:
      "Quarterly planning for Q4 product roadmap and feature prioritization",
    startTime: new Date("2024-09-27T14:00:00"),
    endTime: new Date("2024-09-27T16:00:00"),
    orgId: "org-amrit",
    createdBy: "user-2",
    videoLink: "https://meet.google.com/abc-defg-hij",
    isRSVPEnabled: true,
    location: "Hybrid (HQ + Zoom)",
    timeZone: "America/Toronto",
    recurrencePattern: "MONTHLY",
    recurrenceCustomRule: undefined,
    reminderMinutesBefore: 30,
    coHostIds: ["user-1", "user-3"],
    rsvpDeadline: new Date("2024-09-26T20:00:00"),
    visibility: "ORGANIZATION",
    autoRecord: true,
    tags: ["planning", "product"],
    attachments: [
      "https://docs.example.com/q4-roadmap",
      "https://docs.example.com/planning-agenda",
    ],
    followUpWorkflow: true,
    createdAt: new Date("2024-09-18"),
    updatedAt: new Date("2024-09-24"),
  },
  {
    id: "meeting-3",
    title: "Client Demo",
    description: "Demo of new features to the client stakeholders",
    startTime: new Date("2024-09-28T11:00:00"),
    endTime: undefined,
    orgId: "org-eac",
    createdBy: "user-1",
    videoLink: "https://teams.microsoft.com/l/meetup-join/xyz",
    isRSVPEnabled: false,
    location: "Virtual",
    timeZone: "America/Los_Angeles",
    recurrencePattern: "NONE",
    recurrenceCustomRule: undefined,
    reminderMinutesBefore: 45,
    coHostIds: ["user-2", "user-3"],
    rsvpDeadline: undefined,
    visibility: "INVITE_ONLY",
    autoRecord: true,
    tags: ["client", "demo"],
    attachments: ["https://docs.example.com/demo-deck"],
    followUpWorkflow: true,
    createdAt: new Date("2024-09-22"),
    updatedAt: new Date("2024-09-25"),
  },
  {
    id: "meeting-4",
    title: "Team Retrospective",
    description:
      "Monthly retrospective to discuss what went well and areas for improvement",
    startTime: new Date("2024-09-30T15:00:00"),
    endTime: new Date("2024-09-30T16:30:00"),
    orgId: "org-book",
    createdBy: "user-3",
    videoLink: undefined,
    isRSVPEnabled: true,
    location: "Book Club Studio",
    timeZone: "America/Chicago",
    recurrencePattern: "MONTHLY",
    recurrenceCustomRule: undefined,
    reminderMinutesBefore: 20,
    coHostIds: ["user-4"],
    rsvpDeadline: new Date("2024-09-29T23:00:00"),
    visibility: "ORGANIZATION",
    autoRecord: false,
    tags: ["retro", "team"],
    attachments: ["https://docs.example.com/retro-template"],
    followUpWorkflow: true,
    createdAt: new Date("2024-09-23"),
    updatedAt: new Date("2024-09-25"),
  },
  {
    id: "meeting-5",
    title: "1:1 with Manager",
    description: "Bi-weekly one-on-one meeting",
    startTime: new Date("2024-10-01T10:00:00"),
    endTime: new Date("2024-10-01T10:30:00"),
    orgId: "org-eac",
    createdBy: "user-1",
    videoLink: undefined,
    isRSVPEnabled: false,
    location: "Virtual",
    timeZone: "America/New_York",
    recurrencePattern: "CUSTOM",
    recurrenceCustomRule: "Every other Tuesday",
    reminderMinutesBefore: 10,
    coHostIds: [],
    rsvpDeadline: undefined,
    visibility: "INVITE_ONLY",
    autoRecord: false,
    tags: ["one-on-one", "coaching"],
    attachments: [],
    followUpWorkflow: false,
    createdAt: new Date("2024-09-24"),
    updatedAt: new Date("2024-09-25"),
  },
];

export const sampleRSVPs: RSVP[] = [
  {
    id: "rsvp-1",
    meetingId: "meeting-1",
    userId: "user-2",
    status: "yes",
    comment: "Looking forward to it!",
    createdAt: new Date("2024-09-21"),
  },
  {
    id: "rsvp-2",
    meetingId: "meeting-1",
    userId: "user-3",
    status: "yes",
    createdAt: new Date("2024-09-22"),
  },
  {
    id: "rsvp-3",
    meetingId: "meeting-2",
    userId: "user-1",
    status: "yes",
    createdAt: new Date("2024-09-19"),
  },
  {
    id: "rsvp-4",
    meetingId: "meeting-2",
    userId: "user-3",
    status: "maybe",
    comment: "Might have a conflict, will confirm later",
    createdAt: new Date("2024-09-23"),
  },
  {
    id: "rsvp-5",
    meetingId: "meeting-4",
    userId: "user-2",
    status: "no",
    comment: "On vacation that week",
    createdAt: new Date("2024-09-24"),
  },
];

export function getMeetingsByUser(userId: string): Meeting[] {
  return sampleMeetings.filter(meeting => meeting.createdBy === userId);
}

export function getRSVPsByUser(userId: string): RSVP[] {
  return sampleRSVPs.filter(rsvp => rsvp.userId === userId);
}

export function getUserById(userId: string): User | undefined {
  return sampleUsers.find(user => user.id === userId);
}

export function getMeetingById(meetingId: string): Meeting | undefined {
  return sampleMeetings.find(meeting => meeting.id === meetingId);
}
