// Availability Polling Types

export type AvailabilityStatus = 'yes' | 'no' | 'maybe';
export type PollStatus = 'open' | 'locked' | 'cancelled';

export interface AvailabilityPoll {
  id: string;
  org_id: string;
  creator_id: string;
  title: string;
  description?: string;

  // Date/time range
  start_date: Date;
  end_date: Date;
  earliest_time: string;  // HH:mm format
  latest_time: string;    // HH:mm format
  time_slot_duration: number; // minutes

  // Nextcloud integration
  nextcloud_poll_id?: string;
  nextcloud_calendar_proposal_id?: string;

  // Status
  status: PollStatus;
  locked_time_slot?: Date;
  final_meeting_id?: string;

  // Settings
  allow_maybe: boolean;
  require_authentication: boolean;
  show_participants: boolean;

  // Metadata
  created_at: Date;
  updated_at: Date;
  deadline?: Date;
  response_count: number;

  // Populated fields (joins)
  creator_name?: string;
  creator_email?: string;
}

export interface AvailabilityResponse {
  id: string;
  poll_id: string;
  user_id?: string;
  user_name: string;
  user_email?: string;
  user_timezone: string;

  created_at: Date;
  updated_at: Date;

  // Populated field
  slots?: AvailabilitySlot[];
}

export interface AvailabilitySlot {
  response_id: string;
  time_slot: Date;
  availability: AvailabilityStatus;
}

// Aggregated availability for a time slot
export interface AvailabilitySummary {
  time_slot: Date;
  total_responses: number;
  yes_count: number;
  maybe_count: number;
  no_count: number;
  availability_score: number; // 0-100, higher = more available
}

// Create poll data
export interface CreatePollData {
  org_id: string;
  creator_id: string;
  title: string;
  description?: string;
  start_date: Date;
  end_date: Date;
  earliest_time: string;
  latest_time: string;
  time_slot_duration?: number;
  allow_maybe?: boolean;
  require_authentication?: boolean;
  show_participants?: boolean;
  deadline?: Date;
}

// Submit response data
export interface SubmitResponseData {
  poll_id: string;
  user_id?: string;
  user_name: string;
  user_email?: string;
  user_timezone: string;
  slots: Array<{
    time_slot: Date;
    availability: AvailabilityStatus;
  }>;
}

// Update response data
export interface UpdateResponseData {
  response_id: string;
  slots: Array<{
    time_slot: Date;
    availability: AvailabilityStatus;
  }>;
}
