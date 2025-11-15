/**
 * Nextcloud Polls Integration
 *
 * Wraps the Nextcloud Polls app API (v1.0)
 * Base URL: /ocs/v2.php/apps/polls/api/v1.0
 *
 * Uses Nextcloud's built-in polling functionality instead of rebuilding it.
 */

import { NextcloudClient } from './client';

// Types based on Nextcloud Polls app
export interface NextcloudPoll {
  id: number;
  type: 'datePoll' | 'textPoll';
  title: string;
  description?: string;
  created: number; // Unix timestamp
  expire: number; // Unix timestamp
  deleted: number; // Unix timestamp (0 if not deleted)
  access: 'public' | 'hidden' | 'registered';
  anonymous: number; // 0 or 1
  allowMaybe: number; // 0 or 1
  voteLimit: number; // 0 = unlimited
  showResults: 'always' | 'closed' | 'never';
  adminAccess: boolean;
  ownerDisplayName: string;
  important: number; // 0 or 1
  // ... additional fields
}

export interface NextcloudPollOption {
  id: number;
  pollId: number;
  pollOptionText: string; // For text polls
  timestamp?: number; // For date polls
  order: number;
  confirmed: number; // 0 or 1
  duration: number; // Minutes
}

export interface NextcloudPollVote {
  id: number;
  pollId: number;
  userId: string;
  voteOptionId: number;
  voteOptionText: string;
  voteAnswer: 'yes' | 'no' | 'maybe';
}

export interface CreatePollOptions {
  type: 'datePoll' | 'textPoll';
  title: string;
  description?: string;
  access?: 'public' | 'hidden' | 'registered';
  anonymous?: boolean;
  allowMaybe?: boolean;
  expire?: Date;
}

export interface AddPollOptionData {
  pollOptionText?: string; // For text polls
  timestamp?: number; // For date polls (Unix timestamp)
  duration?: number; // Minutes
}

/**
 * Create a new poll in Nextcloud
 */
export async function createPoll(
  client: NextcloudClient,
  options: CreatePollOptions
): Promise<NextcloudPoll> {
  const response = await client.ocs.post('/apps/polls/api/v1.0/poll', {
    type: options.type,
    title: options.title,
    description: options.description || '',
    access: options.access || 'registered',
    anonymous: options.anonymous ? 1 : 0,
    allowMaybe: options.allowMaybe ? 1 : 0,
    expire: options.expire ? Math.floor(options.expire.getTime() / 1000) : 0,
  });

  return response.data.ocs.data;
}

/**
 * Get all polls for the authenticated user
 */
export async function getPolls(client: NextcloudClient): Promise<NextcloudPoll[]> {
  const response = await client.ocs.get('/apps/polls/api/v1.0/polls');
  return response.data.ocs.data;
}

/**
 * Get a specific poll by ID
 */
export async function getPoll(
  client: NextcloudClient,
  pollId: number
): Promise<NextcloudPoll> {
  const response = await client.ocs.get(`/apps/polls/api/v1.0/poll/${pollId}`);
  return response.data.ocs.data;
}

/**
 * Get options for a poll
 */
export async function getPollOptions(
  client: NextcloudClient,
  pollId: number
): Promise<NextcloudPollOption[]> {
  const response = await client.ocs.get(`/apps/polls/api/v1.0/poll/${pollId}/options`);
  return response.data.ocs.data;
}

/**
 * Add an option to a poll (for date or text options)
 */
export async function addPollOption(
  client: NextcloudClient,
  pollId: number,
  option: AddPollOptionData
): Promise<NextcloudPollOption> {
  const response = await client.ocs.post(
    `/apps/polls/api/v1.0/poll/${pollId}/option`,
    option
  );
  return response.data.ocs.data;
}

/**
 * Get all votes for a poll
 */
export async function getPollVotes(
  client: NextcloudClient,
  pollId: number
): Promise<NextcloudPollVote[]> {
  const response = await client.ocs.get(`/apps/polls/api/v1.0/poll/${pollId}/votes`);
  return response.data.ocs.data;
}

/**
 * Set a vote for a poll option
 */
export async function setVote(
  client: NextcloudClient,
  pollId: number,
  optionId: number,
  answer: 'yes' | 'no' | 'maybe'
): Promise<NextcloudPollVote> {
  const response = await client.ocs.put(`/apps/polls/api/v1.0/poll/${pollId}/vote`, {
    optionId,
    setTo: answer,
  });
  return response.data.ocs.data;
}

/**
 * Delete a vote
 */
export async function deleteVote(
  client: NextcloudClient,
  pollId: number,
  optionId: number
): Promise<void> {
  await client.ocs.delete(`/apps/polls/api/v1.0/poll/${pollId}/vote`, {
    data: { optionId },
  });
}

/**
 * Close a poll (no more votes allowed)
 */
export async function closePoll(
  client: NextcloudClient,
  pollId: number
): Promise<NextcloudPoll> {
  const response = await client.ocs.put(`/apps/polls/api/v1.0/poll/${pollId}/close`);
  return response.data.ocs.data;
}

/**
 * Reopen a closed poll
 */
export async function reopenPoll(
  client: NextcloudClient,
  pollId: number
): Promise<NextcloudPoll> {
  const response = await client.ocs.put(`/apps/polls/api/v1.0/poll/${pollId}/reopen`);
  return response.data.ocs.data;
}

/**
 * Delete a poll
 */
export async function deletePoll(
  client: NextcloudClient,
  pollId: number
): Promise<void> {
  await client.ocs.delete(`/apps/polls/api/v1.0/poll/${pollId}`);
}

/**
 * Helper: Create an availability poll with time slots
 * This creates a date poll with multiple time options
 */
export async function createAvailabilityPoll(
  client: NextcloudClient,
  options: {
    title: string;
    description?: string;
    timeSlots: Date[];
    allowMaybe?: boolean;
    deadline?: Date;
    slotDuration?: number; // minutes, default 30
  }
): Promise<{ poll: NextcloudPoll; options: NextcloudPollOption[] }> {
  // Create the poll
  const poll = await createPoll(client, {
    type: 'datePoll',
    title: options.title,
    description: options.description,
    access: 'registered',
    allowMaybe: options.allowMaybe ?? true,
    expire: options.deadline,
  });

  // Add time slot options
  const pollOptions = await Promise.all(
    options.timeSlots.map((slot) =>
      addPollOption(client, poll.id, {
        timestamp: Math.floor(slot.getTime() / 1000),
        duration: options.slotDuration || 30,
      })
    )
  );

  return { poll, options: pollOptions };
}

/**
 * Helper: Get aggregated availability results
 * Returns each time slot with vote counts
 */
export async function getAvailabilityResults(
  client: NextcloudClient,
  pollId: number
): Promise<
  Array<{
    option: NextcloudPollOption;
    yes: number;
    no: number;
    maybe: number;
    total: number;
    availabilityScore: number; // 0-100
  }>
> {
  const [options, votes] = await Promise.all([
    getPollOptions(client, pollId),
    getPollVotes(client, pollId),
  ]);

  return options.map((option) => {
    const optionVotes = votes.filter((v) => v.voteOptionId === option.id);
    const yes = optionVotes.filter((v) => v.voteAnswer === 'yes').length;
    const no = optionVotes.filter((v) => v.voteAnswer === 'no').length;
    const maybe = optionVotes.filter((v) => v.voteAnswer === 'maybe').length;
    const total = optionVotes.length;

    // Calculate availability score: yes=1, maybe=0.5, no=0
    const score = total > 0 ? ((yes + maybe * 0.5) / total) * 100 : 0;

    return {
      option,
      yes,
      no,
      maybe,
      total,
      availabilityScore: Math.round(score),
    };
  });
}
