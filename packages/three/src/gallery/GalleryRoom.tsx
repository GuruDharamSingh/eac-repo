import { HallShell } from './rooms/HallShell';
import { PavilionShell } from './rooms/PavilionShell';
import type { RoomDesign } from './designs';

/**
 * The shell for a room design. Nothing here is interactive — pieces mount
 * themselves against the surfaces the design describes.
 */
export function GalleryRoom({ design }: { design: RoomDesign }) {
  return design.id === 'pavilion' ? <PavilionShell /> : <HallShell />;
}
