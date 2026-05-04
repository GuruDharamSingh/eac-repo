import { create } from 'zustand';

export type Direction = 'east' | 'south' | 'west' | 'north';

export type Phase =
  | 'bumper'
  | 'templeDoor'
  | 'templeRoom'
  | `walkingTo:${Direction}`
  | `scene:${Direction}`;

interface SceneState {
  phase: Phase;
  setPhase: (phase: Phase) => void;
  warpTo: (dir: Direction) => void;
  returnToRoom: () => void;
}

export const useSceneStore = create<SceneState>((set) => ({
  phase: 'bumper',
  setPhase: (phase) => set({ phase }),
  warpTo: (dir) => set({ phase: `walkingTo:${dir}` }),
  returnToRoom: () => set({ phase: 'templeRoom' }),
}));
