---
name: Legacy column migrations
description: Renamed/split DB columns can leave old NOT NULL constraints behind on production databases that the current code no longer satisfies.
---

When a column is renamed or split into multiple columns (e.g. a single `usdt`
balance split into `usdt_trc20`/`usdt_bep20`/`usdt_erc20`), the old column
often still exists on databases that were created before the change — and if
it was originally `NOT NULL` with no default, it stays that way. New code
that only writes the new columns will then fail every INSERT into that table
with an `IntegrityError: null value in column "<old_col>" violates not-null
constraint`, even though the table/model looks fully migrated in the current
schema definition.

**Why:** `ADD COLUMN IF NOT EXISTS` migrations are additive-only — they never
touch constraints on old columns, so a stale `NOT NULL` silently survives
every migration run and only surfaces when a real INSERT hits it. This is
easy to miss locally because a fresh local/dev database (created via
`create_all()` from the current model) never had the old column in the first
place, so the bug only reproduces against an actual aged production database.

**How to apply:** Whenever a migration script adds replacement columns for an
old one, also explicitly relax the old column in the same migration list:
`ALTER TABLE x ALTER COLUMN old_col DROP NOT NULL` (and optionally
`SET DEFAULT ...` / backfill nulls). Wrap it the same way as other migration
statements (try/except per statement) so it no-ops harmlessly on databases
where the old column was never created. Don't assume "insert failing only in
production, works fine locally" points to environment/networking — check for
schema drift between the current model and the actual deployed table first.
