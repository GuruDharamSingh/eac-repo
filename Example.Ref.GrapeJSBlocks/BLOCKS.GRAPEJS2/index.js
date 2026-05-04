/**
 * EAC Blocks — Root Index
 * =========================
 * Registers all EAC section blocks with a GrapesJS editor instance.
 *
 * Usage in your Silex client plugin:
 *
 *   import { registerAllEacBlocks } from './eac-blocks/index.js'
 *
 *   export default function EacPlugin(config, options) {
 *     config.on('grapesjs:start', ({ editor }) => {
 *       registerAllEacBlocks(editor)
 *     })
 *   }
 *
 * Or cherry-pick individual blocks:
 *
 *   import { registerEacHero, registerEacPricing } from './eac-blocks/index.js'
 */

export { registerEacHeroComponent, registerEacHeroBlock, registerEacHero }
  from './eac-hero-block/eac-hero.block.js'

export { registerEacFeatureGridComponent, registerEacFeatureGridBlock, registerEacFeatureGrid }
  from './eac-feature-grid/eac-feature-grid.block.js'

export { registerEacCtaGlowComponent, registerEacCtaGlowBlock, registerEacCtaGlow }
  from './eac-cta-glow/eac-cta-glow.block.js'

export { registerEacTestimonialsComponent, registerEacTestimonialsBlock, registerEacTestimonials }
  from './eac-testimonials/eac-testimonials.block.js'

export { registerEacPricingComponent, registerEacPricingBlock, registerEacPricing }
  from './eac-pricing/eac-pricing.block.js'

export { registerEacSplitComponent, registerEacSplitBlock, registerEacSplit }
  from './eac-split-content/eac-split-content.block.js'

export { registerEacMarqueeComponent, registerEacMarqueeBlock, registerEacMarquee }
  from './eac-logo-marquee/eac-logo-marquee.block.js'

export { registerEacStatsComponent, registerEacStatsBlock, registerEacStats }
  from './eac-stat-row/eac-stat-row.block.js'

export { registerEacContactComponent, registerEacContactBlock, registerEacContact }
  from './eac-contact-form/eac-contact-form.block.js'

import { registerEacHero }         from './eac-hero-block/eac-hero.block.js'
import { registerEacFeatureGrid }   from './eac-feature-grid/eac-feature-grid.block.js'
import { registerEacCtaGlow }       from './eac-cta-glow/eac-cta-glow.block.js'
import { registerEacTestimonials }  from './eac-testimonials/eac-testimonials.block.js'
import { registerEacPricing }       from './eac-pricing/eac-pricing.block.js'
import { registerEacSplit }         from './eac-split-content/eac-split-content.block.js'
import { registerEacMarquee }       from './eac-logo-marquee/eac-logo-marquee.block.js'
import { registerEacStats }         from './eac-stat-row/eac-stat-row.block.js'
import { registerEacContact }       from './eac-contact-form/eac-contact-form.block.js'

/**
 * Registers all EAC blocks in dependency order.
 * Component types are always registered before their blocks.
 *
 * @param {import('grapesjs').Editor} editor
 */
export function registerAllEacBlocks(editor) {
  registerEacHero(editor)
  registerEacFeatureGrid(editor)
  registerEacCtaGlow(editor)
  registerEacTestimonials(editor)
  registerEacPricing(editor)
  registerEacSplit(editor)
  registerEacMarquee(editor)
  registerEacStats(editor)
  registerEacContact(editor)
}
