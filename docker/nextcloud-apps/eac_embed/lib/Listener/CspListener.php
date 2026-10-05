<?php

declare(strict_types=1);

namespace OCA\EacEmbed\Listener;

use OCP\AppFramework\Http\EmptyContentSecurityPolicy;
use OCP\EventDispatcher\Event;
use OCP\EventDispatcher\IEventListener;
use OCP\IConfig;
use OCP\Security\CSP\AddContentSecurityPolicyEvent;

/**
 * Adds the configured origins to frame-ancestors on every response that uses
 * the default policy (Talk's call page and public shares included).
 *
 * Only https origins are accepted. Configure with:
 *   occ config:app:set eac_embed frame_ancestors --value "https://elkdonis-arts.org"
 *
 * @template-implements IEventListener<AddContentSecurityPolicyEvent>
 */
class CspListener implements IEventListener {
	public function __construct(
		private IConfig $config,
	) {
	}

	public function handle(Event $event): void {
		if (!($event instanceof AddContentSecurityPolicyEvent)) {
			return;
		}
		$raw = $this->config->getAppValue('eac_embed', 'frame_ancestors', 'https://elkdonis-arts.org');
		$policy = new EmptyContentSecurityPolicy();
		foreach (explode(',', $raw) as $origin) {
			$origin = trim($origin);
			if (preg_match('#^https://[a-z0-9.-]+(:\d+)?$#i', $origin) === 1) {
				$policy->addAllowedFrameAncestorDomain($origin);
			}
		}
		$event->addPolicy($policy);
	}
}
