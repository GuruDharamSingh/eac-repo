/**
 * Nextcloud User Management
 * Handles user creation, synchronization, and group management
 */

import { adminClient } from './client';
import { nextcloudConfig } from './config';
import { webdavService } from './webdav';

export interface NextcloudUser {
  id: string;
  displayname: string;
  email: string;
  groups: string[];
  quota?: {
    used: number;
    total: number;
  };
  enabled: boolean;
}

export interface CreateUserParams {
  userid: string;
  password: string;
  displayName?: string;
  email?: string;
  groups?: string[];
}

class UserService {
  /**
   * Create a new Nextcloud user
   */
  async createUser(params: CreateUserParams): Promise<boolean> {
    try {
      const formData = new URLSearchParams();
      formData.append('userid', params.userid);
      formData.append('password', params.password);

      if (params.displayName) {
        formData.append('displayName', params.displayName);
      }
      if (params.email) {
        formData.append('email', params.email);
      }

      await adminClient.post(nextcloudConfig.api.users, formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      // Add user to groups if specified
      if (params.groups && params.groups.length > 0) {
        for (const group of params.groups) {
          await this.addUserToGroup(params.userid, group);
        }
      }

      return true;
    } catch (error: any) {
      if (error?.response?.status === 400) {
        // User already exists
        console.log(`User ${params.userid} already exists`);
        return false;
      }
      console.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Get user information
   */
  async getUser(userid: string): Promise<NextcloudUser | null> {
    try {
      const data = await adminClient.get(`${nextcloudConfig.api.users}/${userid}`);
      return {
        id: data.id,
        displayname: data.displayname || data.id,
        email: data.email || '',
        groups: data.groups || [],
        quota: data.quota,
        enabled: data.enabled !== false,
      };
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return null;
      }
      console.error('Error getting user:', error);
      throw error;
    }
  }

  /**
   * Update user information
   */
  async updateUser(
    userid: string,
    field: string,
    value: string
  ): Promise<boolean> {
    try {
      const formData = new URLSearchParams();
      formData.append('key', field);
      formData.append('value', value);

      await adminClient.put(
        `${nextcloudConfig.api.users}/${userid}`,
        formData.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
      return true;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  /**
   * Create a group
   */
  async createGroup(groupid: string): Promise<boolean> {
    try {
      const formData = new URLSearchParams();
      formData.append('groupid', groupid);

      await adminClient.post(
        nextcloudConfig.api.groups,
        formData.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
      return true;
    } catch (error: any) {
      if (error?.response?.status === 400) {
        // Group already exists
        console.log(`Group ${groupid} already exists`);
        return false;
      }
      console.error('Error creating group:', error);
      throw error;
    }
  }

  /**
   * Add user to group
   */
  async addUserToGroup(userid: string, groupid: string): Promise<boolean> {
    try {
      // First ensure the group exists
      await this.createGroup(groupid);

      const formData = new URLSearchParams();
      formData.append('groupid', groupid);

      await adminClient.post(
        `${nextcloudConfig.api.users}/${userid}/groups`,
        formData.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
      return true;
    } catch (error) {
      console.error('Error adding user to group:', error);
      throw error;
    }
  }

  /**
   * Remove user from group
   */
  async removeUserFromGroup(
    userid: string,
    groupid: string
  ): Promise<boolean> {
    try {
      await adminClient.delete(
        `${nextcloudConfig.api.users}/${userid}/groups?groupid=${groupid}`
      );
      return true;
    } catch (error) {
      console.error('Error removing user from group:', error);
      throw error;
    }
  }

  /**
   * Sync user from app database to Nextcloud
   * Returns the app password for newly created users, or null for existing users
   */
  async syncUser(userData: {
    id: string;
    email: string;
    displayName?: string;
    orgId?: string;
  }): Promise<{ success: boolean; appPassword?: string }> {
    try {
      // Check if user exists
      const existingUser = await this.getUser(userData.id);

      if (!existingUser) {
        // Generate secure password for new user
        const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
        let appPassword = '';
        for (let i = 0; i < 32; i++) {
          appPassword += charset[Math.floor(Math.random() * charset.length)];
        }

        await this.createUser({
          userid: userData.id,
          password: appPassword,
          displayName: userData.displayName,
          email: userData.email,
          groups: userData.orgId ? [userData.orgId] : [],
        });

        // Create user's personal folder
        await webdavService.createDirectory(`/${userData.id}`);

        // Return the password so it can be stored in database
        return { success: true, appPassword };
      } else {
        // Update existing user if needed
        if (userData.displayName && userData.displayName !== existingUser.displayname) {
          await this.updateUser(userData.id, 'displayname', userData.displayName);
        }
        if (userData.email && userData.email !== existingUser.email) {
          await this.updateUser(userData.id, 'email', userData.email);
        }

        // Add to organization group if not already
        if (userData.orgId && !existingUser.groups.includes(userData.orgId)) {
          await this.addUserToGroup(userData.id, userData.orgId);
        }

        // User already exists, no new password
        return { success: true };
      }
    } catch (error) {
      console.error('Error syncing user:', error);
      throw error;
    }
  }

  /**
   * List all users
   */
  async listUsers(): Promise<string[]> {
    try {
      const data = await adminClient.get(nextcloudConfig.api.users);
      return data.users || [];
    } catch (error) {
      console.error('Error listing users:', error);
      throw error;
    }
  }

  /**
   * List all groups
   */
  async listGroups(): Promise<string[]> {
    try {
      const data = await adminClient.get(nextcloudConfig.api.groups);
      return data.groups || [];
    } catch (error) {
      console.error('Error listing groups:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const userService = new UserService();

// Export class for custom instances
export default UserService;