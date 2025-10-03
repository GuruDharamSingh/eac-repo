import { prisma } from "@elkdonis/db";
import type {
  Prisma,
  Organization as PrismaOrganization,
  User as PrismaUser,
} from "@elkdonis/db";
import type {
  Meeting,
  Organization,
  RSVP,
  User,
  MeetingVisibility,
  MeetingRecurrence,
} from "@elkdonis/types";

type MeetingWithRelations = Prisma.MeetingGetPayload<{
  include: {
    organization: true;
    creator: true;
  };
}>;

type RSVPWithUser = Prisma.RSVPGetPayload<{
  include: {
    user: true;
  };
}>;

export interface CreateMeetingParams {
  title: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  orgId: string;
  createdBy: string;
  videoLink?: string;
  isRSVPEnabled: boolean;
  location?: string;
  timeZone?: string;
  recurrencePattern: MeetingRecurrence;
  recurrenceCustomRule?: string;
  reminderMinutesBefore?: number;
  coHostIds?: string[];
  rsvpDeadline?: Date;
  visibility: MeetingVisibility;
  autoRecord: boolean;
  tags?: string[];
  attachments?: string[];
  followUpWorkflow: boolean;
}

const mapOrganization = (organization: PrismaOrganization): Organization => ({
  id: organization.id,
  name: organization.name,
  createdAt: organization.createdAt,
  updatedAt: organization.updatedAt,
});

const mapUser = (user: PrismaUser): User => ({
  id: user.id,
  name: user.name,
  email: user.email,
  password: undefined,
  avatarUrl: user.avatarUrl ?? undefined,
  isSuperadmin: user.isSuperadmin,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const mapMeeting = (meeting: MeetingWithRelations): Meeting => ({
  id: meeting.id,
  title: meeting.title,
  description: meeting.description ?? undefined,
  startTime: meeting.startTime,
  endTime: meeting.endTime ?? undefined,
  orgId: meeting.orgId,
  createdBy: meeting.createdBy,
  videoLink: meeting.videoLink ?? undefined,
  isRSVPEnabled: meeting.isRSVPEnabled,
  location: meeting.location ?? undefined,
  timeZone: meeting.timeZone ?? undefined,
  recurrencePattern: meeting.recurrencePattern,
  recurrenceCustomRule: meeting.recurrenceCustomRule ?? undefined,
  reminderMinutesBefore: meeting.reminderMinutesBefore ?? undefined,
  coHostIds: meeting.coHostIds ?? [],
  rsvpDeadline: meeting.rsvpDeadline ?? undefined,
  visibility: meeting.visibility,
  autoRecord: meeting.autoRecord,
  tags: meeting.tags ?? [],
  attachments: meeting.attachments ?? [],
  followUpWorkflow: meeting.followUpWorkflow,
  createdAt: meeting.createdAt,
  updatedAt: meeting.updatedAt,
  organization: meeting.organization ? mapOrganization(meeting.organization) : undefined,
  creator: meeting.creator ? mapUser(meeting.creator) : undefined,
});

const mapRSVP = (rsvp: RSVPWithUser): RSVP => ({
  id: rsvp.id,
  meetingId: rsvp.meetingId,
  userId: rsvp.userId,
  status: rsvp.status.toLowerCase() as RSVP["status"],
  comment: rsvp.comment ?? undefined,
  createdAt: rsvp.createdAt,
  user: rsvp.user ? mapUser(rsvp.user) : undefined,
});

export async function createMeeting(params: CreateMeetingParams): Promise<Meeting> {
  const meeting = await prisma.meeting.create({
    data: {
      title: params.title,
      description: params.description ?? null,
      startTime: params.startTime,
      endTime: params.endTime ?? null,
      orgId: params.orgId,
      createdBy: params.createdBy,
      videoLink: params.videoLink ?? null,
      isRSVPEnabled: params.isRSVPEnabled,
      location: params.location ?? null,
      timeZone: params.timeZone ?? null,
      recurrencePattern: params.recurrencePattern,
      recurrenceCustomRule:
        params.recurrencePattern === "CUSTOM"
          ? params.recurrenceCustomRule ?? null
          : null,
      reminderMinutesBefore: params.reminderMinutesBefore ?? null,
      coHostIds: params.coHostIds ?? [],
      rsvpDeadline: params.rsvpDeadline ?? null,
      visibility: params.visibility,
      autoRecord: params.autoRecord,
      tags: params.tags ?? [],
      attachments: params.attachments ?? [],
      followUpWorkflow: params.followUpWorkflow,
    },
    include: {
      organization: true,
      creator: true,
    },
  });

  return mapMeeting(meeting);
}

export async function getOrganizations(): Promise<Organization[]> {
  const organizations = await prisma.organization.findMany();

  return organizations.map(mapOrganization);
}

export async function getMeetings(): Promise<Meeting[]> {
  const meetings = await prisma.meeting.findMany({
    include: {
      organization: true,
      creator: true,
    },
    orderBy: {
      startTime: "asc",
    },
  });

  return meetings.map(mapMeeting);
}

export async function getMeetingsByUser(userId: string): Promise<Meeting[]> {
  const meetings = await prisma.meeting.findMany({
    where: {
      createdBy: userId,
    },
    include: {
      organization: true,
      creator: true,
    },
    orderBy: {
      startTime: "asc",
    },
  });

  return meetings.map(mapMeeting);
}

export async function getRSVPsByUser(userId: string): Promise<RSVP[]> {
  const rsvps = await prisma.rSVP.findMany({
    where: {
      userId,
    },
    include: {
      user: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return rsvps.map(mapRSVP);
}

export async function getUserById(userId: string): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (!user) return null;

  return mapUser(user);
}

export async function getMeetingById(meetingId: string): Promise<Meeting | null> {
  const meeting = await prisma.meeting.findUnique({
    where: {
      id: meetingId,
    },
    include: {
      organization: true,
      creator: true,
    },
  });

  if (!meeting) return null;

  return mapMeeting(meeting);
}
