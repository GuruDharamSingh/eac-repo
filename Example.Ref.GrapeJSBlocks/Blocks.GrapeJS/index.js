/**
 * EAC Hero Block — Entry Point
 * ==============================
 * Barrel file. Import from here in your Silex client plugin
 * or GrapesJS editor init.
 *
 * Usage — register both at once:
 *
 *   import { registerEacHero } from './eac-hero/index.js'
 *   registerEacHero(editor)
 *
 * Usage — register independently (if your lifecycle requires it):
 *
 *   import {
 *     registerEacHeroComponent,
 *     registerEacHeroBlock,
 *   } from './eac-hero/index.js'
 *
 *   registerEacHeroComponent(editor)  // always first
 *   registerEacHeroBlock(editor)      // always after
 */

export { registerEacHeroComponent } from './eac-hero.component.js'
export { registerEacHeroBlock }      from './eac-hero.block.js'

import { registerEacHeroComponent } from './eac-hero.component.js'
import { registerEacHeroBlock }      from './eac-hero.block.js'

/**
 * Convenience: registers component type then block in one call.
 * Component type must be registered first so the block's HTML
 * is parsed correctly when dropped into the canvas.
 *
 * @param {import('grapesjs').Editor} editor
 */
export function registerEacHero(editor) {
  registerEacHeroComponent(editor)
  registerEacHeroBlock(editor)
}
