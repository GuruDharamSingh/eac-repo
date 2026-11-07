// The Recordings kind's contract with its host, in the Studio's pattern: no
// data access of its own; the host binds server actions and routes.

export interface RecordingItem {
  name: string;
  /** Nextcloud path, inside the person's Private/Video/{Recordings,Camera,Broadcasts}. */
  path: string;
  size: number;
  modified: string | null;
  folder: 'Recordings' | 'Camera' | 'Broadcasts';
}

/** A recording still inside the broadcast booth (the OBS container). */
export interface BoothRecording {
  name: string;
  size: number;
  modified: string;
  copy?: {
    state: 'copying' | 'done' | 'failed';
    step: 'preparing' | 'converting' | 'sending' | null;
    sent: number;
    size: number;
    path: string;
    by: string;
    error: string | null;
  } | null;
}

export type RecordingResult<T> = { ok: true; value: T } | { ok: false; error: string };

export interface RecordingKindProps {
  initialItems: RecordingItem[];
  actions: {
    list(): Promise<RecordingItem[]>;
    rename(path: string, name: string): Promise<RecordingResult<{ path: string }>>;
    remove(path: string): Promise<RecordingResult<null>>;
  };
  /** Signed-in chunked upload into Private/Video/Recordings. */
  uploadEndpoint: string;
  /** Phone handoff codes; absent hides "Phone". */
  captureEndpoint?: string;
  phoneHost?: string;
  /** Prefix for playing a path, e.g. "/api/media/". */
  mediaBase: string;
  /** "Use in a reel": the Video kind. */
  reelHref?: string;
  /** The booth's own recordings (admins): copy into Private/Video/Broadcasts. Absent hides the section. */
  booth?: {
    list(): Promise<RecordingResult<BoothRecording[]>>;
    copy(file: string): Promise<RecordingResult<unknown>>;
    remove(file: string): Promise<RecordingResult<null>>;
  };
}
