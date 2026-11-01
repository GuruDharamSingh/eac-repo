/**
 * Measured from "The Morning Room" (The Hallwyl Museum, Sketchfab, CC BY 4.0),
 * a photogrammetry scan: walls by ray-casting a fan from the room centre, each
 * frame opening by snapping a hand-placed box to the velvet edge in a square-on
 * render and fitting the picture plane with rays (see the session scripts
 * mr_walls.py, mr_refine.py, mr_slots3d.py). Gallery world frame, metres, Y up.
 * Generated — edit the measurements, not this file, if the model changes.
 */
export const MORNING_FLOOR_Y = 0.13;
export const MORNING_CENTRE: [number, number] = [0.085, 0.125];

/** The four walls in walking order: a point on each, its outward normal, its width. */
export const MORNING_WALLS = [
  {
    "point": [
      -1.001,
      -2.314
    ],
    "outward": [
      -0.4067,
      -0.9135
    ],
    "width": 7.08
  },
  {
    "point": [
      -2.838,
      1.427
    ],
    "outward": [
      -0.9135,
      0.4067
    ],
    "width": 6.03
  },
  {
    "point": [
      1.033,
      2.254
    ],
    "outward": [
      0.4067,
      0.9135
    ],
    "width": 6.88
  },
  {
    "point": [
      3.036,
      -1.189
    ],
    "outward": [
      0.9135,
      -0.4067
    ],
    "width": 5.7
  }
] as const;

export type MorningSlotShape = 'rect' | 'octagon';

/** Picture openings: corners top-left, top-right, bottom-right, bottom-left as seen facing the wall. */
export const MORNING_SLOTS: ReadonlyArray<{ id: string; wall: number; shape: MorningSlotShape; corners: [number, number, number][] }> = [
  { id: "lady-in-white", wall: 0, shape: 'rect', corners: [[-3.3118, 3.5448, -1.3182], [-2.2737, 3.5448, -1.7238], [-2.2796, 1.4683, -1.7371], [-3.3177, 1.4683, -1.3315]] },
  { id: "boy-in-white", wall: 0, shape: 'rect', corners: [[0.2353, 3.0257, -2.6864], [0.725, 3.0257, -2.9088], [0.7259, 2.394, -2.9069], [0.2361, 2.394, -2.6844]] },
  { id: "boy-in-red", wall: 0, shape: 'rect', corners: [[0.1975, 2.225, -2.6477], [0.5623, 2.225, -2.7972], [0.5515, 1.5557, -2.8216], [0.1867, 1.5557, -2.6721]] },
  { id: "man-writing", wall: 1, shape: 'rect', corners: [[-2.248, 3.8378, 2.9518], [-2.4769, 3.8378, 2.3695], [-2.5111, 3.0753, 2.3847], [-2.2822, 3.0753, 2.967]] },
  { id: "man-seated", wall: 1, shape: 'rect', corners: [[-2.2213, 2.8629, 3.0493], [-2.5197, 2.8629, 2.286], [-2.5459, 1.7628, 2.2976], [-2.2475, 1.7628, 3.061]] },
  { id: "old-gentleman", wall: 1, shape: 'rect', corners: [[-3.4361, 3.8004, -0.0837], [-3.6685, 3.8004, -0.6849], [-3.6776, 3.0004, -0.6808], [-3.4452, 3.0004, -0.0796]] },
  { id: "child-l1", wall: 2, shape: 'octagon', corners: [[3.6224, 3.7817, 1.2822], [3.3486, 3.7817, 1.3893], [3.3488, 3.463, 1.3899], [3.6227, 3.463, 1.2827]] },
  { id: "child-l2", wall: 2, shape: 'octagon', corners: [[3.6297, 3.288, 1.2831], [3.3377, 3.288, 1.3955], [3.3381, 2.9567, 1.3965], [3.6301, 2.9567, 1.284]] },
  { id: "child-l3", wall: 2, shape: 'octagon', corners: [[3.6183, 2.7879, 1.2882], [3.3378, 2.7879, 1.3958], [3.3385, 2.4629, 1.3973], [3.6189, 2.4629, 1.2896]] },
  { id: "child-l4", wall: 2, shape: 'octagon', corners: [[3.6097, 2.2879, 1.2993], [3.3367, 2.2879, 1.393], [3.3387, 1.9566, 1.3974], [3.6117, 1.9566, 1.3038]] },
  { id: "child-l5", wall: 2, shape: 'octagon', corners: [[3.5973, 1.7753, 1.3024], [3.3398, 1.7753, 1.4004], [3.3442, 1.444, 1.41], [3.6016, 1.444, 1.3121]] },
  { id: "child-r1", wall: 2, shape: 'octagon', corners: [[-1.4224, 3.8067, 3.2434], [-1.7147, 3.8067, 3.3552], [-1.7144, 3.4817, 3.3559], [-1.422, 3.4817, 3.2441]] },
  { id: "child-r2", wall: 2, shape: 'octagon', corners: [[-1.4267, 3.2942, 3.249], [-1.7087, 3.2942, 3.3532], [-1.7084, 2.9755, 3.3539], [-1.4264, 2.9755, 3.2497]] },
  { id: "child-r3", wall: 2, shape: 'octagon', corners: [[-1.429, 2.7879, 3.2443], [-1.6936, 2.7879, 3.3569], [-1.6926, 2.4692, 3.3592], [-1.4279, 2.4692, 3.2466]] },
  { id: "child-r4", wall: 2, shape: 'octagon', corners: [[-1.4221, 2.2817, 3.2444], [-1.6991, 2.2817, 3.3597], [-1.6975, 1.9316, 3.3633], [-1.4205, 1.9316, 3.248]] },
  { id: "child-r5", wall: 2, shape: 'octagon', corners: [[-1.4152, 1.7755, 3.2445], [-1.6922, 1.7755, 3.3598], [-1.6906, 1.4254, 3.3634], [-1.4136, 1.4254, 3.2481]] },
  { id: "over-mantel", wall: 3, shape: 'rect', corners: [[1.1578, 3.4757, -2.8264], [2.4299, 3.4757, -2.2498], [2.4573, 2.2877, -2.262], [1.1853, 2.2877, -2.8386]] },
  { id: "lady-in-blue", wall: 3, shape: 'rect', corners: [[3.5463, 3.6821, 0.0012], [3.7739, 3.6821, 0.5911], [3.7759, 2.8818, 0.5902], [3.5482, 2.8818, 0.0003]] },
  { id: "lady-at-table", wall: 3, shape: 'rect', corners: [[3.4411, 2.6941, -0.1778], [3.8433, 2.6941, 0.8545], [3.8667, 1.7313, 0.8441], [3.4645, 1.7313, -0.1882]] },
];
