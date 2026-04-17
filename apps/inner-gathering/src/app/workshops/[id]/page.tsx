import React from 'react';
import { notFound } from 'next/navigation';
import { GatheringDetails } from '@/components/gathering-details';
import { getServerSession } from '@elkdonis/auth-server';

// This would normally come from a database query
// For now, providing a high-quality mock to see the design
async function getMockWorkshop(id: string) {
  return {
    id: id,
    orgId: 'inner_group',
    guideId: 'user_1',
    title: 'The Art of Conscious Gathering',
    slug: 'conscious-gathering',
    description: 'Learn to hold space and create transformative experiences for your community.',
    pitch: `
      <h2>Why Conscious Gathering?</h2>
      <p>In a world that is increasingly digital, the art of coming together in person (or intentional digital space) is more vital than ever. This workshop is designed for community leaders, teachers, and anyone who wants to deepen their ability to facilitate connection.</p>
      <h3>What we will cover:</h3>
      <ul>
        <li>The Architecture of Welcome: First impressions and threshold moments.</li>
        <li>Navigating Group Dynamics: Holding the center without being the center.</li>
        <li>Ritual & Rhythm: Creating a narrative arc for your gatherings.</li>
      </ul>
      <p>By the end of this 4-week journey, you will have a complete blueprint for your next event, workshop, or meeting.</p>
    `,
    status: 'published' as const,
    visibility: 'PUBLIC' as const,
    price: 49,
    attendeeCount: 24,
    coverImage: {
      url: 'https://images.unsplash.com/photo-1529070538774-1843cb3265df?auto=format&fit=crop&q=80&w=1000',
    },
    guide: {
      displayName: 'Sunjay',
      avatarUrl: 'https://i.pravatar.cc/150?u=sunjay',
    },
    organization: {
      name: 'InnerGathering',
    },
    sessions: [
      {
        id: 's1',
        workshopId: id,
        title: 'Thresholds & Welcomes',
        description: 'Creating a container that feels safe and inviting from the first second.',
        scheduledAt: new Date('2026-05-01T18:00:00Z'),
        durationMinutes: 90,
        isOnline: true,
        orderIndex: 1,
        resources: [
          {
            id: 'r1',
            title: 'The Welcome Protocol PDF',
            type: 'pdf' as const,
            url: '#',
            isPublic: false,
            description: 'A 5-step guide to greeting participants.'
          },
          {
            id: 'r2',
            title: 'Intro Video',
            type: 'video' as const,
            url: '#',
            isPublic: true,
          }
        ]
      },
      {
        id: 's2',
        workshopId: id,
        title: 'The Narrative Arc',
        description: 'How to structure your content so it flows naturally and builds impact.',
        scheduledAt: new Date('2026-05-08T18:00:00Z'),
        durationMinutes: 90,
        isOnline: true,
        orderIndex: 2,
        resources: [
          {
            id: 'r3',
            title: 'Arc Template',
            type: 'other' as const,
            url: '#',
            isPublic: false,
          }
        ]
      }
    ]
  };
}

export default async function WorkshopPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workshop = await getMockWorkshop(id);
  const session = await getServerSession();

  if (!workshop) {
    notFound();
  }

  const currentUser = session?.user
    ? {
        id: session.user.id,
        displayName: session.user.email?.split('@')[0] ?? null,
        initials: session.user.email?.substring(0, 2).toUpperCase() ?? null,
      }
    : null;

  // Mock replies for now
  const mockReplies = [
    {
      id: 'rep_1',
      userId: 'user_2',
      userName: 'Amrit',
      userInitials: 'AM',
      content: 'So excited for this! The flyer looks beautiful.',
      createdAt: new Date().toISOString(),
      reactionCount: 2,
    }
  ];

  return (
    <GatheringDetails
      gathering={workshop as any}
      type="workshop"
      currentUser={currentUser}
      isJoined={false}
      replies={mockReplies}
    />
  );
}
