import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';

export interface QuestionPoll {
  id: string;
  orgId: string;
  creatorId: string;
  question: string;
  description?: string;
  pollType: 'single_choice' | 'multi_choice';
  status: 'open' | 'closed' | 'cancelled';
  showResultsBeforeVote: boolean;
  deadline?: Date;
  voteCount: number;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
  creatorName?: string;
  options: PollOption[];
}

export interface PollOption {
  id: string;
  pollId: string;
  label: string;
  sortOrder: number;
  voteCount: number;
}

export interface CreateQuestionPollData {
  orgId: string;
  creatorId: string;
  question: string;
  description?: string;
  pollType?: 'single_choice' | 'multi_choice';
  showResultsBeforeVote?: boolean;
  deadline?: Date;
  options: string[];
}

/**
 * Create a new question poll with options
 */
export async function createQuestionPoll(
  data: CreateQuestionPollData
): Promise<QuestionPoll> {
  const pollId = nanoid();

  const [poll] = await db`
    INSERT INTO question_polls (
      id, org_id, creator_id, question, description,
      poll_type, show_results_before_vote, deadline
    ) VALUES (
      ${pollId},
      ${data.orgId},
      ${data.creatorId},
      ${data.question},
      ${data.description || null},
      ${data.pollType || 'single_choice'},
      ${data.showResultsBeforeVote ?? true},
      ${data.deadline || null}
    )
    RETURNING *
  `;

  // Insert options
  const optionRows = data.options.map((label, index) => ({
    id: nanoid(),
    poll_id: pollId,
    label,
    sort_order: index,
    vote_count: 0,
  }));

  await db`
    INSERT INTO poll_options ${db(optionRows)}
  `;

  const options = await db`
    SELECT * FROM poll_options WHERE poll_id = ${pollId} ORDER BY sort_order
  `;

  return mapPollFromDb(poll, options);
}

/**
 * Get a question poll by ID with options
 */
export async function getQuestionPollById(
  pollId: string
): Promise<QuestionPoll | null> {
  const [poll] = await db`
    SELECT p.*, u.display_name as creator_name
    FROM question_polls p
    LEFT JOIN users u ON p.creator_id = u.id
    WHERE p.id = ${pollId}
  `;

  if (!poll) return null;

  const options = await db`
    SELECT * FROM poll_options WHERE poll_id = ${pollId} ORDER BY sort_order
  `;

  return mapPollFromDb(poll, options);
}

/**
 * Get question polls by organization
 */
export async function getQuestionPollsByOrg(
  orgId: string,
  options: { status?: string; limit?: number } = {}
): Promise<QuestionPoll[]> {
  const { status, limit = 50 } = options;

  const polls = await db`
    SELECT p.*, u.display_name as creator_name
    FROM question_polls p
    LEFT JOIN users u ON p.creator_id = u.id
    WHERE p.org_id = ${orgId}
      ${status ? db`AND p.status = ${status}` : db``}
    ORDER BY p.created_at DESC
    LIMIT ${limit}
  `;

  // Fetch options for all polls
  const pollIds = polls.map((p: any) => p.id);
  const allOptions = pollIds.length > 0
    ? await db`
        SELECT * FROM poll_options
        WHERE poll_id = ANY(${pollIds})
        ORDER BY sort_order
      `
    : [];

  return polls.map((poll: any) => {
    const pollOptions = allOptions.filter((o: any) => o.poll_id === poll.id);
    return mapPollFromDb(poll, pollOptions);
  });
}

/**
 * Cast a vote on a poll option
 */
export async function voteOnPoll(
  pollId: string,
  optionId: string,
  userId: string
): Promise<{ success: boolean }> {
  const [poll] = await db`
    SELECT poll_type FROM question_polls WHERE id = ${pollId}
  `;

  if (!poll) throw new Error('Poll not found');

  if (poll.poll_type === 'single_choice') {
    // Remove any existing votes on this poll by this user
    await db`
      DELETE FROM poll_votes
      WHERE poll_id = ${pollId} AND user_id = ${userId}
    `;
  }

  // Insert vote (unique constraint handles duplicates for multi_choice)
  await db`
    INSERT INTO poll_votes (id, poll_id, option_id, user_id)
    VALUES (${nanoid()}, ${pollId}, ${optionId}, ${userId})
    ON CONFLICT (poll_id, option_id, user_id) DO NOTHING
  `;

  return { success: true };
}

/**
 * Remove a vote from a poll option
 */
export async function unvoteOnPoll(
  pollId: string,
  optionId: string,
  userId: string
): Promise<{ success: boolean }> {
  await db`
    DELETE FROM poll_votes
    WHERE poll_id = ${pollId}
      AND option_id = ${optionId}
      AND user_id = ${userId}
  `;

  return { success: true };
}

/**
 * Get user's votes for a poll
 */
export async function getUserVotes(
  pollId: string,
  userId: string
): Promise<string[]> {
  const votes = await db`
    SELECT option_id FROM poll_votes
    WHERE poll_id = ${pollId} AND user_id = ${userId}
  `;

  return votes.map((v: any) => v.option_id);
}

/**
 * Delete a question poll (cascade deletes options and votes)
 */
export async function deleteQuestionPoll(pollId: string): Promise<void> {
  await db`DELETE FROM question_polls WHERE id = ${pollId}`;
}

/**
 * Close a question poll
 */
export async function closeQuestionPoll(pollId: string): Promise<QuestionPoll | null> {
  const [poll] = await db`
    UPDATE question_polls
    SET status = 'closed', closed_at = NOW(), updated_at = NOW()
    WHERE id = ${pollId}
    RETURNING *
  `;

  if (!poll) return null;

  const options = await db`
    SELECT * FROM poll_options WHERE poll_id = ${pollId} ORDER BY sort_order
  `;

  return mapPollFromDb(poll, options);
}

// ─── Mapping helpers ───

function mapPollFromDb(row: any, optionRows: any[] = []): QuestionPoll {
  return {
    id: row.id,
    orgId: row.org_id,
    creatorId: row.creator_id,
    question: row.question,
    description: row.description || undefined,
    pollType: row.poll_type,
    status: row.status,
    showResultsBeforeVote: row.show_results_before_vote,
    deadline: row.deadline ? new Date(row.deadline) : undefined,
    voteCount: row.vote_count || 0,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    closedAt: row.closed_at ? new Date(row.closed_at) : undefined,
    creatorName: row.creator_name || undefined,
    options: optionRows.map(mapOptionFromDb),
  };
}

function mapOptionFromDb(row: any): PollOption {
  return {
    id: row.id,
    pollId: row.poll_id,
    label: row.label,
    sortOrder: row.sort_order,
    voteCount: row.vote_count || 0,
  };
}
