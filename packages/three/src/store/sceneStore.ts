import { create } from 'zustand';

export type Direction = 'east' | 'south' | 'west' | 'north';

export type Phase =
  | 'bumper'
  | 'templeDoor'
  | 'templeRoom'
  | `walkingTo:${Direction}`
  | `scene:${Direction}`;

/** Clockwise seen from above: turning right while facing east faces south. */
const CLOCKWISE: Direction[] = ['east', 'south', 'west', 'north'];

interface SceneState {
  phase: Phase;
  /** The door the visitor faces while standing in the temple room. */
  facing: Direction;
  setPhase: (phase: Phase) => void;
  /** Quarter turn: 1 = right, -1 = left. */
  turn: (step: 1 | -1) => void;
  warpTo: (dir: Direction) => void;
  returnToRoom: () => void;
}

export const useSceneStore = create<SceneState>((set) => ({
  phase: 'bumper',
  facing: 'east',
  setPhase: (phase) =>
    set(() => {
      const m = phase.match(/^walkingTo:(.+)$/);
      return m ? { phase, facing: m[1] as Direction } : { phase };
    }),
  turn: (step) =>
    set((s) => ({ facing: CLOCKWISE[(CLOCKWISE.indexOf(s.facing) + step + 4) % 4]! })),
  warpTo: (dir) => set({ phase: `walkingTo:${dir}`, facing: dir }),
  returnToRoom: () => set({ phase: 'templeRoom' }),
}));
