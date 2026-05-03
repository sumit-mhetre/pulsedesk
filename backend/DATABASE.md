# SimpleRx EMR Backend - Database Operations Runbook

## 🛑 Never do this

```bash
npx prisma migrate dev        # ← BYPASSES THE GUARD. Can reset production.
```

If Prisma prompts:
```
✖ We need to reset the ... schema.  Do you want to continue? All data will be lost. ...
```

**Always answer `no`.** This prompt means you're about to destroy every row in every table.

## ✅ Safe commands

| Command | What it does | Safe against prod? |
|---|---|---|
| `npm run migrate` | Guarded `migrate dev` - aborts if DATABASE_URL isn't `localhost` | ✅ Yes |
| `npm run migrate:prod` | `migrate deploy` - applies pending migrations without reset | ✅ Yes |
| `npx prisma migrate deploy` | Same as above, bare form | ✅ Yes |
| `npx prisma studio` | Read/edit DB in browser GUI, manually | ⚠️ Depends which DB you point at |
| `npx prisma generate` | Regenerates Prisma client, no DB changes | ✅ Yes |
| `npm run seed` | Upserts super admin, clinic, base users | ✅ Yes (non-destructive) |

## Environment files

- `backend/.env` - production DATABASE_URL (Render Postgres). Destructive commands must never run against this.
- `backend/.env.development` - local Postgres at `localhost:5432/pulsedesk_dev`. Gitignored. Used by `npm run dev`.
- `backend/.env.example` - committed template (no secrets).

`src/index.js` auto-picks `.env.development` if it exists and `NODE_ENV !== 'production'`.

## Typical workflows

### "I changed schema.prisma and need a new migration"

```bash
# 1. Make sure you're on local (.env.development exists and is loaded)
# 2. Create the migration
npm run migrate
#    → Prisma creates backend/prisma/migrations/<timestamp>_<name>/migration.sql
# 3. Review the SQL, verify it's what you expected
# 4. Commit the migration folder + updated schema.prisma
git add backend/prisma/migrations/ backend/prisma/schema.prisma
git commit -m "feat(db): <what you changed>"
git push origin main
# 5. Render runs `npx prisma migrate deploy` on build → production gets the migration safely
```

### "I need to reset local DB and start fresh"

```bash
# Drop and recreate local DB (you must be sure this is local!)
psql -U postgres -c "DROP DATABASE pulsedesk_dev;"
psql -U postgres -c "CREATE DATABASE pulsedesk_dev;"
npm run migrate:prod   # apply all migrations to empty local DB
npm run seed
```

### "I need to apply an existing migration to production manually"

Usually not needed - Render's build step does this. If you truly need to run from your machine:

```bash
# Temporarily point at production (DANGEROUS - don't leave it pointed here)
# With .env.development removed or NODE_ENV=production
npx prisma migrate deploy
```

## Post-mortem - 2026-04-22 incident

- User ran `npx prisma migrate dev` with `backend/.env` pointing at production Render Postgres
- Prisma detected schema drift, offered to reset the schema to match migrations folder
- User confirmed `yes`
- All tables dropped and re-created → all data lost (only single-user testing data, recovered via seed)
- Root causes: (1) `.env` held production URL, (2) no separate local DB, (3) no guard on destructive commands
- All three addressed by this runbook + `scripts/guard-migrate-dev.js` + split env files
