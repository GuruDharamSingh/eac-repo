-- 207: a store's commission defaults to the platform's cut.
--
-- `store.commission_rate` defaulted to 30.00 from the first marketplace
-- schema. The developer's figure (2026-10-18) is 5%: the collective's standing
-- cut on a sale, which the Center and the auction journey quote to an artist
-- before they publish. `resolveSettlement` reads this column for artwork, so
-- the quoted number and the charged number come from the same row.
--
-- An organisation's store that hosts other people's work is written with 0 by
-- `openOrgStore`; what an org keeps from its artists is a matter between them
-- (an agreement, `org_agreements`), not a store default. Existing rows are not
-- changed here: their rates were set per store and are the stores' own.

ALTER TABLE store ALTER COLUMN commission_rate SET DEFAULT 5.00;
