import { create } from 'zustand';
import type { WallSide } from './layout';
import type { Venue } from './venue';
import type { FrameRatio } from './framing';

/**
 * How the hall is being looked at.
 *
 * `overview`: the whole hall held in space, seen from above with the walls
 * nearest the camera cut away, to be orbited and hung from. `wall`: the
 * cutaway — the camera steady outside one side, looking in at the other wall
 * and sliding along the route. `walk`: first person, inside.
 */
export type ViewMode = 'overview' | 'wall' | 'walk';

export interface Viewpoint {
  position: [number, number, number];
  lookAt: [number, number, number];
}

/** What is being carried toward a wall: a work from the tray, or one already hung. */
export interface HallwayDrag {
  pieceId: string;
  /** Width over height of the image, known before its texture has loaded. */
  aspect: number;
  heightCm: number | null;
  widthCm: number | null;
  frameId: string | null;
  /** The piece's size multiplier, kept through a move. */
  scale: number;
  /** The frame's proportion, kept through a move so the outline has its shape. */
  ratio: FrameRatio;
  source: 'tray' | 'wall';
}

/** A line the carried piece snapped to: drawn on the wall while it is held. */
export interface SnapGuide {
  axis: 'x' | 'y';
  /** Along the face (x) or world height (y). */
  at: number;
}

/** Where the carried piece would land if let go now. */
export interface DropTarget {
  wallId: string;
  x: number;
  y: number;
  /** Outer size including the frame, for the outline. */
  width: number;
  height: number;
  /** False when it would overlap a neighbour or run off the wall. */
  valid: boolean;
  guides: SnapGuide[];
}

/** A corner handle being dragged: the piece and its provisional scale. */
export interface Resize {
  pieceId: string;
  scale: number;
}

interface HallwayState {
  /** The pointer over the canvas in normalised device coordinates, while carrying. */
  pointer: { x: number; y: number } | null;
  drag: HallwayDrag | null;
  target: DropTarget | null;
  selectedId: string | null;
  focus: Viewpoint | null;
  hoveredId: string | null;
  /** Outer size of each hung piece, for overlap checks while placing another. */
  sizes: Record<string, { width: number; height: number }>;
  /** Each hung piece's picture size at scale 1 (no frame), for the inspector's numbers. */
  baseSizes: Record<string, { width: number; height: number }>;
  /** A corner handle drag in progress. */
  resize: Resize | null;
  /** Alt held: snapping off while placing. */
  snapOff: boolean;
  /** The space on show. Set by HallwayExperience before anything in the scene reads it. */
  venue: Venue | null;
  viewMode: ViewMode;
  /** The cutaway: which wall is being looked at, and where along the route. */
  wallSide: WallSide;
  wallS: number;
  /** A press on a hung piece is in progress; camera drags hold off until it resolves. */
  pressing: boolean;
  /** Walking at seated eye height rather than standing. Visitors start this way. */
  crouching: boolean;

  setPointer: (pointer: { x: number; y: number } | null) => void;
  startDrag: (drag: HallwayDrag) => void;
  endDrag: () => void;
  setTarget: (target: DropTarget | null) => void;
  select: (id: string | null, focus?: Viewpoint | null) => void;
  setHoveredId: (id: string | null) => void;
  setSize: (id: string, width: number, height: number) => void;
  setBaseSize: (id: string, width: number, height: number) => void;
  setResize: (resize: Resize | null) => void;
  setSnapOff: (off: boolean) => void;
  setViewMode: (mode: ViewMode) => void;
  setWall: (side: WallSide, s: number) => void;
  setPressing: (pressing: boolean) => void;
  setCrouching: (crouching: boolean) => void;
  release: () => void;
}

/**
 * Module-level like the gallery's store: one hallway per page.
 *
 * The drop target is computed inside the canvas (it needs the camera and the
 * wall meshes) and read outside it (the drop handler is a DOM event), which is
 * why it lives here rather than in either.
 */
export const useHallwayStore = create<HallwayState>((set) => ({
  pointer: null,
  drag: null,
  target: null,
  selectedId: null,
  focus: null,
  hoveredId: null,
  sizes: {},
  baseSizes: {},
  resize: null,
  snapOff: false,
  venue: null,
  viewMode: 'overview',
  wallSide: 'L',
  wallS: 6,
  pressing: false,
  crouching: true,

  setPointer: (pointer) => set({ pointer }),
  startDrag: (drag) => set({ drag, target: null }),
  endDrag: () => set({ drag: null, target: null, pointer: null }),
  setTarget: (target) => set({ target }),
  select: (selectedId, focus = null) => set({ selectedId, focus }),
  setHoveredId: (hoveredId) => set({ hoveredId }),
  setSize: (id, width, height) =>
    set((s) => {
      const was = s.sizes[id];
      if (was && Math.abs(was.width - width) < 1e-4 && Math.abs(was.height - height) < 1e-4) return s;
      return { sizes: { ...s.sizes, [id]: { width, height } } };
    }),
  setBaseSize: (id, width, height) =>
    set((s) => {
      const was = s.baseSizes[id];
      if (was && Math.abs(was.width - width) < 1e-4 && Math.abs(was.height - height) < 1e-4) return s;
      return { baseSizes: { ...s.baseSizes, [id]: { width, height } } };
    }),
  setResize: (resize) => set({ resize }),
  setSnapOff: (snapOff) => set({ snapOff }),
  setViewMode: (viewMode) => set({ viewMode, focus: null }),
  setWall: (wallSide, wallS) => set({ viewMode: 'wall', wallSide, wallS, focus: null }),
  setPressing: (pressing) => set({ pressing }),
  setCrouching: (crouching) => set({ crouching }),
  release: () => set({ selectedId: null, focus: null }),
}));
