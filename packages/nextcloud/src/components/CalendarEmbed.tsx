/**
 * Nextcloud Calendar Embed Component
 * Specialized wrapper for embedding Nextcloud Calendar app
 */

'use client';

import React from 'react';
import { NextcloudEmbed } from './NextcloudEmbed';

export interface CalendarEmbedProps {
  /** Nextcloud base URL */
  baseUrl: string;
  /** Specific calendar to show (optional) */
  calendarId?: string;
  /** Initial view: 'month' | 'week' | 'day' | 'list' */
  view?: 'month' | 'week' | 'day' | 'list';
  /** Initial date to show (ISO string) */
  date?: string;
  /** Container className */
  className?: string;
  /** Height of the iframe */
  height?: string | number;
  /** Callback when event is created/updated */
  onEventChange?: (eventId: string) => void;
}

/**
 * Embed Nextcloud Calendar app
 *
 * Usage:
 * ```tsx
 * // Show calendar with default view
 * <CalendarEmbed />
 *
 * // Show specific calendar in week view
 * <CalendarEmbed calendarId="personal" view="week" />
 * ```
 */
export function CalendarEmbed({
  baseUrl,
  calendarId,
  view = 'month',
  date,
  className,
  height = '700px',
  onEventChange,
}: CalendarEmbedProps) {
  const params: Record<string, string> = {};

  if (view) params.view = view;
  if (date) params.date = date;

  // Build app path
  const appPath = calendarId
    ? `/apps/calendar/calendars/${calendarId}`
    : '/apps/calendar';

  // Handle messages from iframe (for detecting event changes)
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Security: verify origin matches Nextcloud URL
      if (!baseUrl || !event.origin.startsWith(baseUrl)) {
        return;
      }

      // Handle calendar event changes
      if (
        (event.data?.type === 'event-created' || event.data?.type === 'event-updated') &&
        event.data?.eventId
      ) {
        onEventChange?.(event.data.eventId);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [baseUrl, onEventChange]);

  return (
    <NextcloudEmbed
      baseUrl={baseUrl}
      appPath={appPath}
      params={params}
      title="Calendar"
      className={className}
      height={height}
    />
  );
}

/**
 * Embed calendar in month view
 */
export function CalendarMonthView(props: Omit<CalendarEmbedProps, 'view'>) {
  return <CalendarEmbed {...props} view="month" />;
}

/**
 * Embed calendar in week view
 */
export function CalendarWeekView(props: Omit<CalendarEmbedProps, 'view'>) {
  return <CalendarEmbed {...props} view="week" />;
}

/**
 * Embed calendar in day view
 */
export function CalendarDayView(props: Omit<CalendarEmbedProps, 'view'>) {
  return <CalendarEmbed {...props} view="day" />;
}

/**
 * Embed calendar in list view (agenda)
 */
export function CalendarListView(props: Omit<CalendarEmbedProps, 'view'>) {
  return <CalendarEmbed {...props} view="list" />;
}
