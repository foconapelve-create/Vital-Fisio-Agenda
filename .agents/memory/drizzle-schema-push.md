---
name: Drizzle schema push
description: How to create/update PostgreSQL tables from the Drizzle schema in this project.
---

## The Rule
After any schema change in `lib/db/src/schema/`, run the schema push to apply it to the DB.

**Command:**
```bash
cd lib/db && pnpm run push-force
```

**Why:** Drizzle ORM doesn't auto-migrate at startup. Tables won't exist until this is run. The `push` script uses `drizzle-kit push --force` which applies schema changes without interactive prompts.

**How to apply:** Run this after:
- Adding new tables to the schema
- Adding new columns to existing tables
- Any other schema modifications

The startup migration code in `artifacts/api-server/src/index.ts` handles `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for additive column changes, but the initial table creation requires this push.
