export interface Meeting {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  location: string | null;
  scheduled_at: string | null;
  duration_minutes: number | null;
  is_online: boolean;
  meeting_url: string | null;
  status: string;
  section?: string | null;
}
