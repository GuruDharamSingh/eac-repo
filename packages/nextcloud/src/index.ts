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
export * from './org-folders';
export * from './users';
export * from './talk';
export * from './deck';
export * from './calendar';
export * from './shares';
export * from './org-provisioning';
export * from './workshop-materials';

// React components (optional)
export * from './components';

// Reading a calendar back (the write side is calendar.ts). See calendar-read.ts.
export { listCalendarObjects, deleteCalendarObject } from './calendar-read';
export type { CalendarObject, CalendarInstance } from './calendar-read';
