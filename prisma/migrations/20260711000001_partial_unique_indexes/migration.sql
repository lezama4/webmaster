-- Partial unique indexes on "proposals" (ADR D4, B1 pr2-review).
--
-- Applied strictly AFTER the base migration (B3/N2): both indexes reference
-- the "proposals" table in its final shape. Identifiers are Prisma's
-- generated ones — table mapped to "proposals", columns kept camelCase and
-- quoted, enum labels kept in the schema's literal casing.
--
-- 1) At most ONE accepted Proposal per Slot — the accept cascade's
--    belt-and-braces guarantee under concurrency.
CREATE UNIQUE INDEX proposals_accepted_per_slot
  ON "proposals" ("slotId")
  WHERE "status" = 'ACCEPTED'::"ProposalStatus";

-- 2) At most ONE simultaneously-submitted Proposal per Artist per Slot
--    (M2 DECISION). Resubmit-after-reject stays allowed: rejected rows do
--    not match the predicate.
CREATE UNIQUE INDEX proposals_submitted_per_slot_artist
  ON "proposals" ("slotId", "artistProfileId")
  WHERE "status" = 'SUBMITTED'::"ProposalStatus";
