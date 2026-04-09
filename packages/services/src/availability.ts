import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';
import type {
  AvailabilityPoll,
  AvailabilityResponse,
  AvailabilitySlot,
  AvailabilitySummary,
  CreatePollData,
  SubmitResponseData,
  UpdateResponseData,
} from '@elkdonis/types';

/**
 * Create a new availability poll
 */
export async function createAvailabilityPoll(
  data: CreatePollData
): Promise<AvailabilityPoll> {
  const id = nanoid();

  const [poll] = await db`
    INSERT INTO availability_polls (
      id,
      org_id,
      creator_id,
      title,
      description,
      start_date,
      end_date,
      earliest_time,
      latest_time,
      time_slot_duration,
      allow_maybe,
      require_authentication,
      show_participants,
      deadline
    ) VALUES (
      ${id},
      ${data.org_id},
      ${data.creator_id},
      ${data.title},
      ${data.description || null},
      ${data.start_date},
      ${data.end_date},
      ${data.earliest_time},
      ${data.latest_time},
      ${data.time_slot_duration || 30},
      ${data.allow_maybe ?? true},
      ${data.require_authentication ?? true},
      ${data.show_participants ?? true},
      ${data.deadline || null}
    )
    RETURNING *
  `;

  return mapPollFromDb(poll);
}

/**
 * Get a single poll by ID
 */
export async function getPollById(pollId: string): Promise<AvailabilityPoll | null> {
  const [poll] = await db`
    SELECT
      p.*,
      u.display_name as creator_name,
      u.email as creator_email
    FROM availability_polls p
    LEFT JOIN users u ON p.creator_id = u.id
    WHERE p.id = ${pollId}
  `;

  return poll ? mapPollFromDb(poll) : null;
}

/**
 * Get polls by organization
 */
export async function getPollsByOrg(
  orgId: string,
  options: {
    status?: 'open' | 'locked' | 'cancelled';
    limit?: number;
  } = {}
): Promise<AvailabilityPoll[]> {
  const { status, limit = 50 } = options;

  const polls = await db`
    SELECT
      p.*,
      u.display_name as creator_name,
      u.email as creator_email
    FROM availability_polls p
    LEFT JOIN users u ON p.creator_id = u.id
    WHERE p.org_id = ${orgId}
      ${status ? db`AND p.status = ${status}` : db``}
    ORDER BY p.created_at DESC
    LIMIT ${limit}
  `;

  return polls.map(mapPollFromDb);
}

/**
 * Submit or update availability response
 */
export async function submitAvailabilityResponse(
  data: SubmitResponseData
): Promise<AvailabilityResponse> {
  // Check if response already exists
  const existing = await db`
    SELECT id FROM availability_responses
    WHERE poll_id = ${data.poll_id}
      ${data.user_id ? db`AND user_id = ${data.user_id}` : db`AND user_id IS NULL`}
  `;

  let responseId: string;

  if (existing.length > 0) {
    // Update existing response
    responseId = existing[0].id;

    await db`
      UPDATE availability_responses
      SET user_name = ${data.user_name},
          user_email = ${data.user_email || null},
          user_timezone = ${data.user_timezone},
          updated_at = NOW()
      WHERE id = ${responseId}
    `;

    // Delete old slots
    await db`
      DELETE FROM availability_slots
      WHERE response_id = ${responseId}
    `;
  } else {
    // Create new response
    responseId = nanoid();

    await db`
      INSERT INTO availability_responses (
        id,
        poll_id,
        user_id,
        user_name,
        user_email,
        user_timezone
      ) VALUES (
        ${responseId},
        ${data.poll_id},
        ${data.user_id || null},
        ${data.user_name},
        ${data.user_email || null},
        ${data.user_timezone}
      )
    `;
  }

  // Insert new slots
  if (data.slots.length > 0) {
    await db`
      INSERT INTO availability_slots ${db(
        data.slots.map(slot => ({
          response_id: responseId,
          time_slot: slot.time_slot,
          availability: slot.availability,
        }))
      )}
    `;
  }

  // Fetch and return the complete response
  const [response] = await db`
    SELECT * FROM availability_responses
    WHERE id = ${responseId}
  `;

  return mapResponseFromDb(response);
}

/**
 * Get all responses for a poll
 */
export async function getPollResponses(
  pollId: string
): Promise<AvailabilityResponse[]> {
  const responses = await db`
    SELECT * FROM availability_responses
    WHERE poll_id = ${pollId}
    ORDER BY created_at ASC
  `;

  // Fetch slots for each response
  for (const response of responses) {
    const slots = await db`
      SELECT * FROM availability_slots
      WHERE response_id = ${response.id}
      ORDER BY time_slot ASC
    `;
    response.slots = slots;
  }

  return responses.map(mapResponseFromDb);
}

/**
 * Get aggregated availability summary for a poll
 */
export async function getPollSummary(
  pollId: string
): Promise<AvailabilitySummary[]> {
  const summary = await db`
    SELECT
      s.time_slot,
      COUNT(DISTINCT s.response_id) as total_responses,
      COUNT(DISTINCT CASE WHEN s.availability = 'yes' THEN s.response_id END) as yes_count,
      COUNT(DISTINCT CASE WHEN s.availability = 'maybe' THEN s.response_id END) as maybe_count,
      COUNT(DISTINCT CASE WHEN s.availability = 'no' THEN s.response_id END) as no_count
    FROM availability_slots s
    JOIN availability_responses r ON s.response_id = r.id
    WHERE r.poll_id = ${pollId}
    GROUP BY s.time_slot
    ORDER BY s.time_slot ASC
  `;

  return summary.map(row => ({
    time_slot: new Date(row.time_slot),
    total_responses: Number(row.total_responses),
    yes_count: Number(row.yes_count),
    maybe_count: Number(row.maybe_count),
    no_count: Number(row.no_count),
    availability_score: calculateAvailabilityScore(
      Number(row.yes_count),
      Number(row.maybe_count),
      Number(row.total_responses)
    ),
  }));
}

/**
 * Lock a poll with chosen time
 */
export async function lockPoll(
  pollId: string,
  timeSlot: Date
): Promise<AvailabilityPoll> {
  const [poll] = await db`
    UPDATE availability_polls
    SET status = 'locked',
        locked_time_slot = ${timeSlot},
        updated_at = NOW()
    WHERE id = ${pollId}
    RETURNING *
  `;

  return mapPollFromDb(poll);
}

/**
 * Cancel a poll
 */
export async function cancelPoll(pollId: string): Promise<AvailabilityPoll> {
  const [poll] = await db`
    UPDATE availability_polls
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE id = ${pollId}
    RETURNING *
  `;

  return mapPollFromDb(poll);
}

/**
 * Delete a poll (and all responses via CASCADE)
 */
export async function deletePoll(pollId: string): Promise<void> {
  await db`
    DELETE FROM availability_polls
    WHERE id = ${pollId}
  `;
}

// Helper functions
function mapPollFromDb(row: any): AvailabilityPoll {
  return {
    id: row.id,
    org_id: row.org_id,
    creator_id: row.creator_id,
    title: row.title,
    description: row.description,
    start_date: new Date(row.start_date),
    end_date: new Date(row.end_date),
    earliest_time: row.earliest_time,
    latest_time: row.latest_time,
    time_slot_duration: row.time_slot_duration,
    nextcloud_poll_id: row.nextcloud_poll_id,
    nextcloud_calendar_proposal_id: row.nextcloud_calendar_proposal_id,
    status: row.status,
    locked_time_slot: row.locked_time_slot ? new Date(row.locked_time_slot) : undefined,
    final_meeting_id: row.final_meeting_id,
    allow_maybe: row.allow_maybe,
    require_authentication: row.require_authentication,
    show_participants: row.show_participants,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
    deadline: row.deadline ? new Date(row.deadline) : undefined,
    response_count: row.response_count,
    creator_name: row.creator_name,
    creator_email: row.creator_email,
  };
}

function mapResponseFromDb(row: any): AvailabilityResponse {
  return {
    id: row.id,
    poll_id: row.poll_id,
    user_id: row.user_id,
    user_name: row.user_name,
    user_email: row.user_email,
    user_timezone: row.user_timezone,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
    slots: row.slots?.map((slot: any) => ({
      response_id: slot.response_id,
      time_slot: new Date(slot.time_slot),
      availability: slot.availability,
    })),
  };
}

function calculateAvailabilityScore(
  yesCount: number,
  maybeCount: number,
  totalCount: number
): number {
  if (totalCount === 0) return 0;

  // Yes = 1 point, Maybe = 0.5 points
  const score = (yesCount + maybeCount * 0.5) / totalCount;
  return Math.round(score * 100);
}
