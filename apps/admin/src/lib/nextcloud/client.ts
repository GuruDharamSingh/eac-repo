/**
 * Nextcloud Client
 * Core client for interacting with Nextcloud APIs
 */

import axios, { AxiosInstance } from 'axios';
import { nextcloudConfig, getNextcloudUrl } from './config';

class NextcloudClient {
  private axiosInstance: AxiosInstance;
  private auth: string;

  constructor(username?: string, password?: string) {
    const user = username || nextcloudConfig.adminUser;
    const pass = password || nextcloudConfig.adminPassword;

    this.auth = Buffer.from(`${user}:${pass}`).toString('base64');

    this.axiosInstance = axios.create({
      baseURL: nextcloudConfig.baseUrl,
      headers: {
        'Authorization': `Basic ${this.auth}`,
        'OCS-APIRequest': 'true',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      response => response,
      error => {
        console.error('Nextcloud API error:', {
          url: error.config?.url,
          status: error.response?.status,
          data: error.response?.data,
        });
        throw error;
      }
    );
  }

  /**
   * Make a GET request to Nextcloud OCS API
   */
  async get(endpoint: string, params?: any) {
    const response = await this.axiosInstance.get(endpoint, {
      params: { ...params, format: 'json' },
    });
    return response.data?.ocs?.data || response.data;
  }

  /**
   * Make a POST request to Nextcloud OCS API
   */
  async post(endpoint: string, data?: any, config?: any) {
    const response = await this.axiosInstance.post(endpoint, data, {
      ...config,
      params: { format: 'json', ...(config?.params || {}) },
    });
    return response.data?.ocs?.data || response.data;
  }

  /**
   * Make a PUT request to Nextcloud OCS API
   */
  async put(endpoint: string, data?: any, config?: any) {
    const response = await this.axiosInstance.put(endpoint, data, {
      ...config,
      params: { format: 'json', ...(config?.params || {}) },
    });
    return response.data?.ocs?.data || response.data;
  }

  /**
   * Make a DELETE request to Nextcloud OCS API
   */
  async delete(endpoint: string, params?: any) {
    const response = await this.axiosInstance.delete(endpoint, {
      params: { ...params, format: 'json' },
    });
    return response.data?.ocs?.data || response.data;
  }

  /**
   * Make a raw request (without OCS wrapper)
   */
  async rawRequest(config: any) {
    const response = await this.axiosInstance.request(config);
    return response.data;
  }

  /**
   * Get the axios instance for custom operations
   */
  getAxiosInstance() {
    return this.axiosInstance;
  }
}

// Export a singleton instance for admin operations
export const adminClient = new NextcloudClient();

// Export the class for creating user-specific clients
export default NextcloudClient;