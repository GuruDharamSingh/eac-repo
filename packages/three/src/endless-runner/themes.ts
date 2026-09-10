export interface RunnerTheme {
  name: string;
  sky: number;
  ground: number;
  obstacle: number;
  decor: number;
}

export const RUNNER_THEMES: RunnerTheme[] = [
  { name: 'Candy', sky: 0xffd1dc, ground: 0xfff0f5, obstacle: 0xff6b6b, decor: 0x98fb98 },
  { name: 'Neon', sky: 0x1a1a2e, ground: 0x16213e, obstacle: 0xe94560, decor: 0x0f3460 },
  { name: 'Sunset', sky: 0xff9a8b, ground: 0xff6a88, obstacle: 0x2c3e50, decor: 0xf9ca24 },
  { name: 'Mint', sky: 0xe0f7fa, ground: 0xffffff, obstacle: 0x009688, decor: 0x80cbc4 },
  { name: 'Midnight', sky: 0x000000, ground: 0x222222, obstacle: 0xffff00, decor: 0x444444 },
];

export function randomTheme(): RunnerTheme {
  return RUNNER_THEMES[Math.floor(Math.random() * RUNNER_THEMES.length)]!;
}

export const RUNNER_CONFIG = {
  laneWidth: 2.5,
  gravity: 0.015,
  jumpPower: 0.35,
  baseSpeed: 0.2,
  speedIncrement: 0.0001,
  rowGap: 3,
  spawnZ: -60,
  despawnZ: 10,
  obstacleCount: 14,
  decorCount: 18,
  artStandCount: 6,
  /** Chance a roadside slot shows a painting rather than a tree. */
  artStandChance: 0.45,
  /** Chance an obstacle is a painting rather than a plain shape. */
  artObstacleChance: 0.32,
  hitbox: 0.8,
};
