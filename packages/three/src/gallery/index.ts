export { GalleryExperience, type GalleryExperienceProps } from './GalleryExperience';
export { GalleryScene, type GallerySceneProps } from './GalleryScene';
export { GalleryRoom } from './GalleryRoom';
export { SplatObject, type SplatObjectProps } from './SplatObject';
export { HallShell } from './rooms/HallShell';
export { PavilionShell } from './rooms/PavilionShell';
export {
  HALL,
  PAVILION,
  ROOM_DESIGNS,
  getDesign,
  type RoomDesign,
  type RoomDesignId,
  type RoomDimensions,
  type CentreWall,
} from './designs';
export { HangingPiece, type HangingPieceProps } from './HangingPiece';
export { Plinth, type PlinthProps } from './Plinth';
export { GalleryControls, type GalleryControlsProps } from './controls/GalleryControls';
export { Thumbstick } from './ui/Thumbstick';
export { useMediaQuery } from './useMediaQuery';
export {
  readTouchMove,
  setTouchMove,
  clearTouchMove,
  type TouchMove,
} from './controls/touch-input';
export { useGalleryStore, type Viewpoint } from './store';
export {
  ROOM,
  SURFACES,
  PLINTH,
  EYE_Y,
  HANG_CENTRE_Y,
  MIN_FLOOR_CLEARANCE,
  BODY_RADIUS,
  hangCentreFor,
  trueSizeMetres,
  VIEW_DISTANCE,
  clampToRoom,
  fitPiece,
  getSurface,
  layoutGallery,
  viewpointForPlinth,
  viewpointForSlot,
} from './room';
export type {
  FittedSize,
  GalleryLayout,
  GalleryPiece,
  PlinthSlot,
  SurfaceId,
  WallSlot,
  WallSurface,
} from './types';
