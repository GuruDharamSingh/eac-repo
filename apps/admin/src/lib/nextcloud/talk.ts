/**
 * Nextcloud Talk Integration
 * Handles video conferencing and chat functionality
 */

import { adminClient } from './client';
import { getTalkUrl } from './config';

export interface TalkRoom {
  token: string;
  type: number; // 1=one-to-one, 2=group, 3=public
  name: string;
  displayName: string;
  objectType: string;
  objectId: string;
  participantType: number;
  participantFlags: number;
  readOnly: boolean;
  hasPassword: boolean;
  hasCall: boolean;
  canStartCall: boolean;
  lastActivity: number;
  lastMessage?: {
    id: number;
    token: string;
    actorType: string;
    actorId: string;
    actorDisplayName: string;
    timestamp: number;
    message: string;
    messageParameters: any;
    systemMessage: string;
    messageType: string;
    isReplyable: boolean;
  };
}

export interface CreateRoomParams {
  roomType?: 2 | 3; // 2=group, 3=public
  roomName?: string;
  invite?: string[]; // User IDs to invite
}

export interface TalkMessage {
  id: number;
  token: string;
  actorType: string;
  actorId: string;
  actorDisplayName: string;
  timestamp: number;
  message: string;
  messageParameters: any;
  systemMessage: string;
  messageType: string;
  isReplyable: boolean;
}

class TalkService {
  /**
   * Create a new Talk room
   */
  async createRoom(params: CreateRoomParams): Promise<TalkRoom> {
    try {
      const formData = new URLSearchParams();
      formData.append('roomType', String(params.roomType || 3));
      if (params.roomName) {
        formData.append('roomName', params.roomName);
      }

      const room = await adminClient.post(
        getTalkUrl('room'),
        formData.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      // Invite users if specified
      if (params.invite && params.invite.length > 0) {
        for (const userId of params.invite) {
          await this.addParticipant(room.token, userId);
        }
      }

      return room;
    } catch (error) {
      console.error('Error creating Talk room:', error);
      throw error;
    }
  }

  /**
   * Get room details
   */
  async getRoom(token: string): Promise<TalkRoom | null> {
    try {
      const room = await adminClient.get(getTalkUrl(`room/${token}`));
      return room;
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return null;
      }
      console.error('Error getting room:', error);
      throw error;
    }
  }

  /**
   * List all rooms for current user
   */
  async listRooms(): Promise<TalkRoom[]> {
    try {
      const rooms = await adminClient.get(getTalkUrl('room'));
      return rooms || [];
    } catch (error) {
      console.error('Error listing rooms:', error);
      throw error;
    }
  }

  /**
   * Add participant to room
   */
  async addParticipant(
    token: string,
    userId: string,
    source: string = 'users'
  ): Promise<boolean> {
    try {
      const formData = new URLSearchParams();
      formData.append('newParticipant', userId);
      formData.append('source', source);

      await adminClient.post(
        getTalkUrl(`room/${token}/participants`),
        formData.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
      return true;
    } catch (error) {
      console.error('Error adding participant:', error);
      throw error;
    }
  }

  /**
   * Remove participant from room
   */
  async removeParticipant(
    token: string,
    participantId: string
  ): Promise<boolean> {
    try {
      await adminClient.delete(
        getTalkUrl(`room/${token}/participants/${participantId}`)
      );
      return true;
    } catch (error) {
      console.error('Error removing participant:', error);
      throw error;
    }
  }

  /**
   * Send a message to a room
   */
  async sendMessage(
    token: string,
    message: string,
    replyTo?: number
  ): Promise<TalkMessage> {
    try {
      const formData = new URLSearchParams();
      formData.append('message', message);
      if (replyTo) {
        formData.append('replyTo', String(replyTo));
      }

      const response = await adminClient.post(
        getTalkUrl(`chat/${token}`),
        formData.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
      return response;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  /**
   * Get messages from a room
   */
  async getMessages(
    token: string,
    lookIntoFuture: boolean = false,
    limit: number = 100,
    lastKnownMessageId?: number
  ): Promise<TalkMessage[]> {
    try {
      const params: any = {
        lookIntoFuture: lookIntoFuture ? 1 : 0,
        limit,
      };
      if (lastKnownMessageId) {
        params.lastKnownMessageId = lastKnownMessageId;
      }

      const messages = await adminClient.get(
        getTalkUrl(`chat/${token}`),
        params
      );
      return messages || [];
    } catch (error) {
      console.error('Error getting messages:', error);
      throw error;
    }
  }

  /**
   * Delete a room
   */
  async deleteRoom(token: string): Promise<boolean> {
    try {
      await adminClient.delete(getTalkUrl(`room/${token}`));
      return true;
    } catch (error) {
      console.error('Error deleting room:', error);
      throw error;
    }
  }

  /**
   * Set room password
   */
  async setRoomPassword(token: string, password: string): Promise<boolean> {
    try {
      const formData = new URLSearchParams();
      formData.append('password', password);

      await adminClient.put(
        getTalkUrl(`room/${token}/password`),
        formData.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
      return true;
    } catch (error) {
      console.error('Error setting room password:', error);
      throw error;
    }
  }

  /**
   * Create a room for a meeting
   */
  async createMeetingRoom(meetingData: {
    id: string;
    title: string;
    orgId: string;
    participantIds?: string[];
  }): Promise<TalkRoom> {
    const room = await this.createRoom({
      roomType: 3, // Public room
      roomName: `${meetingData.orgId}-meeting-${meetingData.id}: ${meetingData.title}`,
      invite: meetingData.participantIds,
    });

    return room;
  }

  /**
   * Get public link for a room
   */
  getPublicLink(token: string): string {
    return `${process.env.NEXT_PUBLIC_NEXTCLOUD_URL || 'http://localhost:8080'}/index.php/call/${token}`;
  }
}

// Export singleton instance
export const talkService = new TalkService();

// Export class for custom instances
export default TalkService;