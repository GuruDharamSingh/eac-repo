/**
 * @elkdonis/nextcloud
 * 
 * Nextcloud integration for Elkdonis Arts Collective
 * Modular package - apps import only what they need
 */

// Core client
export { createNextcloudClient, getAdminClient } from './client';
export type { NextcloudClient, NextcloudConfig } from './client';

// Feature modules (import individually)
export * from './files';
export * from './users';
export * from './talk';
export * from './polls';
export * from './calendar';

// React components (optional)
export * from './components';
