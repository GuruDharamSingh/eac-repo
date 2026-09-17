import { create } from 'zustand';
import type { GalleryPiece } from './types';

export interface Viewpoint {
  position: [number, number, number];
  lookAt: [number, number, number];
}

interface GalleryState {
  /** The piece whose detail panel is open, if any. */
  selected: GalleryPiece | null;
  /** Where the camera is being taken. Cleared once the visitor walks away. */
  focus: Viewpoint | null;
  /** True while the camera is still travelling, so the panel can wait for it. */
  arriving: boolean;
  /**
   * What the pointer is over. Captions are drawn in the overlay rather than in
   * the scene so there is no 3D font to load — troika's default face is
   * fetched from a CDN, which a self-hosted room should not depend on.
   */
  hoveredId: string | null;

  setHoveredId: (id: string | null) => void;
  approach: (piece: GalleryPiece, viewpoint: Viewpoint) => void;
  arrive: () => void;
  release: () => void;
}

/**
 * Module-level, like the temple's scene store: a page is expected to host one
 * gallery. Two on the same page would share a selection.
 */
export const useGalleryStore = create<GalleryState>((set) => ({
  selected: null,
  focus: null,
  arriving: false,
  hoveredId: null,

  setHoveredId: (hoveredId) => set({ hoveredId }),
  approach: (piece, viewpoint) => set({ selected: piece, focus: viewpoint, arriving: true }),
  arrive: () => set({ arriving: false }),
  // The focus is dropped along with the selection so the camera hands control
  // back where it stands, rather than springing to wherever it started.
  release: () => set({ selected: null, focus: null, arriving: false }),
}));
