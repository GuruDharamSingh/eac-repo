// ============================================================================
// Ported from "Super Hopper", a procedural 3D endless runner by holasoymalva:
// https://codepen.io/holasoymalva/pen/XJKdqVj  (found via freefrontend.com)
//
// From that pen: the three-lane model, jump physics, spawn cadence, collision
// test and the five theme palettes. Ours: object pooling instead of per-row
// allocation, delta-normalised stepping (the original was fixed-step and ran
// at double speed on a 120Hz display), the artwork panels and stands, and the
// separation of game logic from the React/R3F host.
//
// LICENCE NOT CONFIRMED. CodePen's default terms are MIT unless an author says
// otherwise, but Cloudflare blocked automated access to the pen, so this has
// not actually been read. Confirm with the author or the pen's own notes
// before treating this as cleared — it is currently shipping on a public site.
// ============================================================================

import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  type Material,
  type Texture,
} from 'three';
import { RUNNER_CONFIG, type RunnerTheme } from './themes';

export type RunnerInput = 'left' | 'right' | 'jump';

export interface RunnerWorldOptions {
  theme: RunnerTheme;
  obstacleTextures?: Texture[];
  playerTexture?: Texture | null;
  groundTexture?: Texture | null;
}

export interface RunnerTick {
  score: number;
  crashed: boolean;
  /** Source of the picture that was hit, when the obstacle carried one. */
  hitSrc: string | null;
}

interface PooledObstacle {
  mesh: Mesh;
  material: MeshStandardMaterial;
  lane: number;
  active: boolean;
}

interface PooledArtStand {
  node: Group;
  art: Mesh;
  frame: Mesh;
  post: Mesh;
  material: MeshStandardMaterial;
  active: boolean;
}

/** Height of an artwork panel; width follows the image's own aspect ratio. */
const ART_HEIGHT = 2.2;
const ART_CENTRE_Y = 2.4;

function aspectOf(texture: Texture): number {
  const image = texture.image as { width?: number; height?: number } | undefined;
  if (!image?.width || !image?.height) return 1;
  return image.width / image.height;
}

/**
 * The runner as plain three.js: no React, no renderer, no frame loop of its
 * own. The host drives it with `update(step)` and owns the camera and lights.
 *
 * Obstacles and scenery are pooled and recycled rather than created per row —
 * an endless runner would otherwise allocate and discard meshes for as long as
 * the visitor keeps playing.
 */
export function createRunnerWorld(options: RunnerWorldOptions) {
  let theme = options.theme;
  let obstacleTextures: Texture[] = options.obstacleTextures ?? [];

  const group = new Group();
  const disposables: (Material | { dispose(): void })[] = [];
  let disposed = false;

  const track = <T extends Material | { dispose(): void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  // --- Floor -------------------------------------------------------------
  let groundTexture: Texture | null = null;

  const groundMaterial = track(
    new MeshStandardMaterial({ color: theme.ground, roughness: 1 }),
  );

  function applyGroundTexture(texture: Texture | null) {
    groundTexture = texture;
    groundMaterial.map = texture;
    groundMaterial.color.set(texture ? 0xffffff : theme.ground);
    groundMaterial.needsUpdate = true;
    if (texture) {
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      texture.repeat.set(6, 12);
    }
  }

  const floor = new Mesh(track(new PlaneGeometry(100, 200)), groundMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -50;
  floor.receiveShadow = true;
  group.add(floor);

  // --- Player ------------------------------------------------------------
  const player = new Group();
  const bodyColors = [0xffffff, 0xaaaaaa, 0xffcc99, 0x333333];
  const bodyColor = bodyColors[Math.floor(Math.random() * bodyColors.length)]!;
  const bodyMaterial = track(new MeshStandardMaterial({ color: bodyColor, flatShading: true }));

  const bodyGeometry = track(new BoxGeometry(1, 1, 1));
  // BoxGeometry groups run [+x, -x, +y, -y, +z, -z]; a face picture belongs on
  // the one the camera actually sees. The slot always exists so an avatar can
  // arrive later without rebuilding the player.
  const faceMaterial = track(new MeshStandardMaterial({ color: bodyColor, flatShading: true }));
  const body = new Mesh(bodyGeometry, [
    bodyMaterial,
    bodyMaterial,
    bodyMaterial,
    bodyMaterial,
    faceMaterial,
    bodyMaterial,
  ]);
  body.position.y = 0.5;
  body.castShadow = true;
  player.add(body);

  const eyeMaterial = track(new MeshBasicMaterial({ color: 0x000000 }));
  const eyeGeometry = track(new BoxGeometry(0.15, 0.15, 0.05));
  const eyes: Mesh[] = [];
  for (const x of [-0.25, 0.25]) {
    const eye = new Mesh(eyeGeometry, eyeMaterial);
    eye.position.set(x, 0.6, 0.5);
    player.add(eye);
    eyes.push(eye);
  }

  function applyPlayerTexture(texture: Texture | null) {
    faceMaterial.map = texture;
    faceMaterial.color.set(texture ? 0xffffff : bodyColor);
    faceMaterial.needsUpdate = true;
    // Drawn-on eyes would sit on top of somebody's face.
    for (const eye of eyes) eye.visible = !texture;
  }

  const earType = Math.floor(Math.random() * 3);
  const earGeometry = track(
    earType === 0
      ? new BoxGeometry(0.2, 0.5, 0.2)
      : earType === 1
        ? new BoxGeometry(0.3, 0.3, 0.1)
        : new ConeGeometry(0.2, 0.4, 4),
  );
  for (const x of [-0.3, 0.3]) {
    const ear = new Mesh(earGeometry, bodyMaterial);
    ear.position.set(x, 1.1, 0);
    ear.castShadow = earType !== 2;
    player.add(ear);
  }
  group.add(player);

  applyGroundTexture(options.groundTexture ?? null);
  applyPlayerTexture(options.playerTexture ?? null);

  // --- Obstacle pool -----------------------------------------------------
  const obstacleGeometries = [
    track(new ConeGeometry(0.5, 1, 6)),
    track(new BoxGeometry(1, 1, 1)),
    track(new CylinderGeometry(0.5, 0.5, 1, 6)),
  ];
  const panelGeometry = track(new BoxGeometry(1, 1, 0.22));

  // Each slot owns its material so a recycled obstacle can carry its own
  // picture without every other obstacle changing with it.
  const obstacles: PooledObstacle[] = [];
  for (let i = 0; i < RUNNER_CONFIG.obstacleCount; i++) {
    const material = track(new MeshStandardMaterial({ color: theme.obstacle, flatShading: true }));
    const mesh = new Mesh(obstacleGeometries[1]!, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.visible = false;
    group.add(mesh);
    obstacles.push({ mesh, material, lane: 0, active: false });
  }

  // --- Scenery pool ------------------------------------------------------
  const trunkMaterial = track(new MeshStandardMaterial({ color: 0x5d4037, flatShading: true }));
  const trunkGeometry = track(new CylinderGeometry(0.2, 0.3, 1.5, 5));
  const leavesMaterial = track(new MeshStandardMaterial({ color: theme.decor, flatShading: true }));
  const leavesGeometry = track(new DodecahedronGeometry(0.8));

  const decor: { node: Group; active: boolean }[] = [];
  for (let i = 0; i < RUNNER_CONFIG.decorCount; i++) {
    const node = new Group();
    const trunk = new Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 0.75;
    trunk.castShadow = true;
    node.add(trunk);
    const leaves = new Mesh(leavesGeometry, leavesMaterial);
    leaves.position.y = 1.8;
    leaves.castShadow = true;
    node.add(leaves);
    node.visible = false;
    group.add(node);
    decor.push({ node, active: false });
  }

  // --- Roadside artwork --------------------------------------------------
  let artwork: Texture[] = [];

  const artGeometry = track(new PlaneGeometry(1, 1));
  const frameGeometry = track(new PlaneGeometry(1, 1));
  const frameMaterial = track(new MeshStandardMaterial({ color: 0x1c1a17, roughness: 0.9 }));
  const postGeometry = track(new CylinderGeometry(0.07, 0.07, 1, 6));
  const postMaterial = track(new MeshStandardMaterial({ color: 0x4a3f35, flatShading: true }));

  const artStands: PooledArtStand[] = [];
  for (let i = 0; i < RUNNER_CONFIG.artStandCount; i++) {
    const node = new Group();

    const post = new Mesh(postGeometry, postMaterial);
    post.castShadow = true;
    node.add(post);

    const frame = new Mesh(frameGeometry, frameMaterial);
    frame.position.set(0, ART_CENTRE_Y, -0.02);
    node.add(frame);

    const material = track(new MeshStandardMaterial({ roughness: 0.85, side: DoubleSide }));
    const art = new Mesh(artGeometry, material);
    art.position.set(0, ART_CENTRE_Y, 0);
    art.castShadow = true;
    node.add(art);

    node.visible = false;
    group.add(node);
    artStands.push({ node, art, frame, post, material, active: false });
  }

  function spawnArtStand(side: number): boolean {
    if (artwork.length === 0) return false;
    const slot = artStands.find((s) => !s.active);
    if (!slot) return false;

    const texture = artwork[Math.floor(Math.random() * artwork.length)]!;
    const width = Math.min(4, Math.max(1.2, ART_HEIGHT * aspectOf(texture)));

    slot.material.map = texture;
    slot.material.needsUpdate = true;
    slot.art.scale.set(width, ART_HEIGHT, 1);
    slot.frame.scale.set(width + 0.2, ART_HEIGHT + 0.2, 1);

    const bottom = ART_CENTRE_Y - ART_HEIGHT / 2;
    slot.post.scale.y = bottom;
    slot.post.position.y = bottom / 2;

    slot.active = true;
    slot.node.visible = true;
    slot.node.position.set(side * (4.6 + Math.random() * 2.5), 0, RUNNER_CONFIG.spawnZ);
    // Angled in towards the road, so it turns through perspective as you pass
    // rather than sliding by as a flat billboard.
    slot.node.rotation.y = side < 0 ? 0.42 : -0.42;
    return true;
  }

  // --- Runtime state -----------------------------------------------------
  const state = {
    score: 0,
    speed: RUNNER_CONFIG.baseSpeed,
    lane: 0,
    laneX: 0,
    jumping: false,
    jumpVelocity: 0,
    playerY: 0,
    bounce: 0,
    spawnTimer: 0,
    crashed: false,
    hitSrc: null as string | null,
  };

  function spawnRow() {
    for (const side of [-1, 1]) {
      if (Math.random() <= 0.3) continue;

      // Every so often the roadside planting is a painting on a stand instead.
      if (Math.random() < RUNNER_CONFIG.artStandChance && spawnArtStand(side)) continue;

      const slot = decor.find((d) => !d.active);
      if (!slot) continue;
      slot.active = true;
      slot.node.visible = true;
      slot.node.position.set(side * (5 + Math.random() * 5), 0, RUNNER_CONFIG.spawnZ);
    }

    if (Math.random() <= 0.3) return;
    const slot = obstacles.find((o) => !o.active);
    if (!slot) return;

    const lane = Math.floor(Math.random() * 3) - 1;
    const pictures = artwork.length > 0 ? artwork : obstacleTextures;
    const usePicture = pictures.length > 0 && Math.random() < RUNNER_CONFIG.artObstacleChance;

    if (usePicture) {
      const texture = pictures[Math.floor(Math.random() * pictures.length)]!;
      // Width tracks the picture's own shape, but stays near the fixed hitbox
      // so what you see is still what you have to dodge.
      const width = Math.min(1.4, Math.max(0.85, 1.15 * aspectOf(texture)));
      slot.material.map = texture;
      slot.material.color.set(0xffffff);
      slot.material.needsUpdate = true;
      slot.mesh.geometry = panelGeometry;
      slot.mesh.scale.set(width, 1.15, 1);
    } else {
      slot.material.map = null;
      slot.material.color.set(theme.obstacle);
      slot.material.needsUpdate = true;
      slot.mesh.geometry = obstacleGeometries[Math.floor(Math.random() * obstacleGeometries.length)]!;
      slot.mesh.scale.set(1, 1, 1);
    }

    slot.active = true;
    slot.lane = lane;
    slot.mesh.visible = true;
    slot.mesh.position.set(lane * RUNNER_CONFIG.laneWidth, 0.5, RUNNER_CONFIG.spawnZ);
  }

  return {
    group,
    player,

    /**
     * Pictures to hang beside the road and hand to obstacles. Settable rather
     * than a construction argument so artwork can arrive mid-session — it is
     * fetched only once someone actually starts a run — without rebuilding the
     * scene around it.
     */
    setArtwork(textures: Texture[]) {
      artwork = textures;
    },

    /**
     * Applied to existing materials rather than taken at construction, so an
     * image finishing its download does not rebuild the world — which would
     * reset a run already in progress.
     */
    setTextures(next: { obstacles?: Texture[]; player?: Texture | null; ground?: Texture | null }) {
      if (next.obstacles) obstacleTextures = next.obstacles;
      if (next.player !== undefined) applyPlayerTexture(next.player);
      if (next.ground !== undefined) applyGroundTexture(next.ground);
    },

    input(action: RunnerInput) {
      if (state.crashed) return;
      if (action === 'left' && state.lane > -1) state.lane--;
      else if (action === 'right' && state.lane < 1) state.lane++;
      else if (action === 'jump' && !state.jumping) {
        state.jumping = true;
        state.jumpVelocity = RUNNER_CONFIG.jumpPower;
      }
    },

    /**
     * `step` is elapsed frames at 60fps, not seconds — the tuning constants
     * came from a fixed-step loop, so normalising here keeps the game playing
     * identically on a 144Hz display instead of running twice as fast.
     */
    update(step: number): RunnerTick {
      if (state.crashed) return { score: state.score, crashed: true, hitSrc: state.hitSrc };

      state.score += state.speed * step;
      state.speed += RUNNER_CONFIG.speedIncrement * step;

      const targetX = state.lane * RUNNER_CONFIG.laneWidth;
      state.laneX += (targetX - state.laneX) * Math.min(1, 0.15 * step);

      if (state.jumping) {
        state.playerY += state.jumpVelocity * step;
        state.jumpVelocity -= RUNNER_CONFIG.gravity * step;
        if (state.playerY <= 0) {
          state.playerY = 0;
          state.jumping = false;
        }
      } else {
        state.bounce += step * 0.9;
        state.playerY = Math.abs(Math.sin(state.bounce)) * 0.1;
      }

      player.position.x = state.laneX;
      player.position.y = state.playerY + 0.5;
      player.rotation.z = (targetX - state.laneX) * -0.08;
      player.rotation.x = state.jumping ? -0.2 : 0;

      if (groundTexture) {
        groundTexture.offset.y -= state.speed * step * 0.02;
      }

      state.spawnTimer += state.speed * step;
      if (state.spawnTimer > RUNNER_CONFIG.rowGap) {
        spawnRow();
        state.spawnTimer = 0;
      }

      const travel = state.speed * 2 * step;

      for (const slot of decor) {
        if (!slot.active) continue;
        slot.node.position.z += travel;
        if (slot.node.position.z > RUNNER_CONFIG.despawnZ) {
          slot.active = false;
          slot.node.visible = false;
        }
      }

      for (const slot of artStands) {
        if (!slot.active) continue;
        slot.node.position.z += travel;
        if (slot.node.position.z > RUNNER_CONFIG.despawnZ) {
          slot.active = false;
          slot.node.visible = false;
        }
      }

      for (const slot of obstacles) {
        if (!slot.active) continue;
        const mesh = slot.mesh;
        const previousZ = mesh.position.z;
        mesh.position.z += travel;

        // Swept, not a fixed window: speed climbs for as long as the run
        // lasts, and once one step covers more than the window an obstacle
        // jumps clean over the player and the game silently becomes
        // unlosable. Testing whether the step CROSSED the player holds at any
        // speed or frame rate.
        if (previousZ <= 0.8 && mesh.position.z >= -0.8) {
          const dx = Math.abs(player.position.x - mesh.position.x);
          const dy = Math.abs(player.position.y - mesh.position.y);
          if (dx < RUNNER_CONFIG.hitbox && dy < RUNNER_CONFIG.hitbox) {
            state.crashed = true;
            state.hitSrc = (slot.material.map?.userData?.src as string | undefined) ?? null;
          }
        }

        if (mesh.position.z > RUNNER_CONFIG.despawnZ) {
          slot.active = false;
          mesh.visible = false;
        }
      }

      return { score: state.score, crashed: state.crashed, hitSrc: state.hitSrc };
    },

    /**
     * Returns the world to its opening state in place. Restarting by tearing
     * the scene down and rebuilding it would rebuild every geometry and
     * material on each death, and leaves the disposal racing the remount.
     */
    reset(nextTheme?: RunnerTheme) {
      if (nextTheme) {
        theme = nextTheme;
        if (!groundTexture) groundMaterial.color.set(theme.ground);
        leavesMaterial.color.set(theme.decor);
      }

      for (const slot of obstacles) {
        slot.active = false;
        slot.mesh.visible = false;
        slot.material.map = null;
        slot.material.color.set(theme.obstacle);
        slot.material.needsUpdate = true;
        slot.mesh.scale.set(1, 1, 1);
      }
      for (const slot of decor) {
        slot.active = false;
        slot.node.visible = false;
      }
      for (const slot of artStands) {
        slot.active = false;
        slot.node.visible = false;
        // Dropped so a stand cannot keep holding a texture the host has
        // already disposed, which three would silently re-upload.
        slot.material.map = null;
        slot.material.needsUpdate = true;
      }

      if (groundTexture) groundTexture.offset.set(0, 0);

      player.position.set(0, 0.5, 0);
      player.rotation.set(0, 0, 0);

      state.score = 0;
      state.speed = RUNNER_CONFIG.baseSpeed;
      state.lane = 0;
      state.laneX = 0;
      state.jumping = false;
      state.jumpVelocity = 0;
      state.playerY = 0;
      state.bounce = 0;
      state.spawnTimer = 0;
      state.crashed = false;
      state.hitSrc = null;
    },

    dispose() {
      // Idempotent, and it deliberately does NOT empty the group. Clearing it
      // here meant a mount/cleanup/mount cycle (React StrictMode does exactly
      // that in development) re-attached an emptied world, leaving a scene
      // with nothing in it but sky and lights.
      if (disposed) return;
      disposed = true;
      for (const item of disposables) item.dispose();
    },
  };
}

export type RunnerWorld = ReturnType<typeof createRunnerWorld>;
