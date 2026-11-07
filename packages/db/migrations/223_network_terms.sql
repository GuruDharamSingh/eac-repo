-- 223: the network's Terms and Acceptable Use as an agreement (2026-11-01).
--
-- One org_agreements row under the collective's own org (`elkdonis`, the
-- network host's org), key `network-terms`, accepted by every new account at
-- signup and by existing members from the hub. The full text is the /terms
-- page on the network host (cms-ui data-policy/Terms.tsx); body_html here
-- is the summary the acceptance refers to. A new version is a new row with
-- version + 1 (the service retires the old one on publish).

INSERT INTO org_agreements (org_id, key, version, title, summary, body_html, revenue_share_percent, terms, status, requires_acceptance, published_at)
SELECT 'elkdonis', 'network-terms', 1,
  'Terms and Acceptable Use',
  'You publish your own work on the network and to any outside account you connect; the collective is the tool and the host, not the publisher.',
  '<p>By using the Elkdonis Arts Collective network you agree that what you publish here, and anything you send to an outside account you connect (Facebook, Instagram, Threads, YouTube), is published by you. The collective hosts it, keeps the keys you give it, and acts on them only when you ask, item by item or on a schedule you set. You can withdraw at any time: remove a connection, delete a post, or ask for your account to be deleted. Content that is unlawful, that you have no right to publish, or that targets a person is not allowed, and an organisation may suspend a member from posting under its name. The full text is at /terms on arts-collective.com.</p>',
  0, '{}'::jsonb, 'active', true, now()
WHERE EXISTS (SELECT 1 FROM organizations WHERE id = 'elkdonis')
ON CONFLICT (org_id, key, version) DO NOTHING;
