'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, type PerspectiveCamera, type Texture } from 'three';
import { createRunnerWorld, type RunnerWorld } from './world';
import type { RunnerTheme } from './themes';

/** Outer lanes sit at ±2.5 with obstacles about a unit wide. */
const TRACK_HALF_WIDTH = 4;

export interface RunnerSceneProps {
  theme: RunnerTheme;
  obstacleTextures: Texture[];
  playerTexture: Texture | null;
  groundTexture: Texture | null;
  /** Roadside paintings and picture-obstacles. */
  artworkTextures: Texture[];
  paused: boolean;
  /** Bumped once per run; the world resets rather than being rebuilt. */
  runId: number;
  worldRef: React.MutableRefObject<RunnerWorld | null>;
  onScore: (score: number) => void;
  onCrash: (score: number, hitSrc: string | null) => void;
}

export function RunnerScene({
  theme,
  obstacleTextures,
  playerTexture,
  groundTexture,
  artworkTextures,
  paused,
  runId,
  worldRef,
  onScore,
  onCrash,
}: RunnerSceneProps) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const crashed = useRef(false);
  const sinceReport = useRef(0);

  // Built once and kept for the life of the canvas. Theme and textures are
  // applied afterwards, so neither a new run nor a late-arriving image
  // rebuilds the world — rebuilding mid-run would reset the run.
  const world = useMemo(
    () => createRunnerWorld({ theme }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    world.setTextures({ obstacles: obstacleTextures, player: playerTexture, ground: groundTexture });
  }, [world, obstacleTextures, playerTexture, groundTexture]);

  useEffect(() => {
    worldRef.current = world;
    return () => {
      worldRef.current = null;
      world.dispose();
    };
  }, [world, worldRef]);

  useEffect(() => {
    crashed.current = false;
    world.reset(theme);
  }, [runId, world, theme]);

  useEffect(() => {
    world.setArtwork(artworkTextures);
  }, [world, artworkTextures]);

  // The stage can be anything from a 175px sidebar column to a full-width
  // block, so the camera backs off until both outer lanes are still in frame
  // rather than assuming a landscape viewport.
  useEffect(() => {
    const perspective = camera as PerspectiveCamera;
    const target = new Vector3(0, 0, -5);
    const offset = new Vector3(0, 7, 10).sub(target);
    const aspect = size.width / Math.max(1, size.height);
    const halfVertical = ((perspective.fov ?? 60) * Math.PI) / 360;
    const halfHorizontal = Math.atan(Math.tan(halfVertical) * aspect);
    const distance = Math.max(offset.length(), TRACK_HALF_WIDTH / Math.tan(halfHorizontal));

    camera.position.copy(target).add(offset.normalize().multiplyScalar(distance));
    camera.lookAt(target);
    perspective.updateProjectionMatrix();
  }, [camera, size]);

  useFrame((_, delta) => {
    if (paused || crashed.current) return;

    // Clamp so a backgrounded tab does not resume with one enormous step that
    // teleports the player through an obstacle.
    const step = Math.min(delta, 1 / 30) * 60;
    const tick = world.update(step);

    sinceReport.current += delta;
    if (sinceReport.current > 0.1) {
      sinceReport.current = 0;
      onScore(tick.score);
    }

    if (tick.crashed) {
      crashed.current = true;
      onCrash(tick.score, tick.hitSrc);
    }
  });

  return (
    <>
      <color attach="background" args={[theme.sky]} />
      <fog attach="fog" args={[theme.sky, 10, 50]} />
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[10, 20, 10]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-far={60}
      />
      {!groundTexture && (
        <gridHelper
          args={[200, 100, 0xffffff, 0xffffff]}
          position={[0, 0.01, -50]}
          material-opacity={0.1}
          material-transparent
        />
      )}
      {/* Keyed so a world swap remounts the node; disposal is the world's job. */}
      <primitive key={world.group.uuid} object={world.group} dispose={null} />
    </>
  );
}
