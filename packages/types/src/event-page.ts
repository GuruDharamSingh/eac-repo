export interface EventPageColors {
  background?: string;
  accent?: string;
  text?: string;
}

export interface EventPageTableData {
  columns: string[];
  rows: string[][];
}

export type EventPageLayout =
  | 'default'
  | 'image-right-text-left'
  | 'image-left-text-right'
  | 'full-width-hero';

export interface EventPage {
  id: string;
  meetingId: string;
  orgId: string;
  content: Record<string, unknown>;
  colors: EventPageColors;
  tableData: EventPageTableData;
  layout: EventPageLayout;
  drawing?: Record<string, unknown> | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}
