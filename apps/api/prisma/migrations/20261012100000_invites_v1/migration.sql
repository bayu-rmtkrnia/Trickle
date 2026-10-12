-- FAMILY invites become RECIPIENT invites, matching the `recipient` role and the
-- `recipients` resource. RENAME VALUE keeps existing rows.
ALTER TYPE "InviteType" RENAME VALUE 'FAMILY' TO 'RECIPIENT';
