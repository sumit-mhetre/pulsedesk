#!/usr/bin/env node
/**
 * Safety guard — prevents `prisma migrate dev` from ever running
 * against a non-local database. Run before `prisma migrate dev`.
 *
 * This exists because `migrate dev` detects drift and will reset the
 * schema (destroying all data) with a single "yes" confirmation.
 * If DATABASE_URL points to production, that's catastrophic.
 *
 * Called automatically via the `migrate` npm script (see package.json).
 */

const path = require('path');
const fs   = require('fs');

// Load the same env file the backend would load
const envDevPath = path.resolve(__dirname, '..', '.env.development');
const envPath    = path.resolve(__dirname, '..', '.env');

if (fs.existsSync(envDevPath) && process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: envDevPath });
} else {
  require('dotenv').config({ path: envPath });
}

const url = process.env.DATABASE_URL || '';

// Whitelist: only these hosts are considered safe for destructive dev migrations.
const SAFE_HOSTS = ['localhost', '127.0.0.1', '::1', 'host.docker.internal'];

// Extract host from DATABASE_URL without pulling in a URL-parsing lib (password may contain @)
// Format: postgresql://user:password@host:port/db?args
const hostMatch = url.match(/@([^:/?]+)(?::\d+)?\//);
const host = hostMatch ? hostMatch[1] : '(unknown)';

if (!SAFE_HOSTS.includes(host)) {
  console.error('\n╔════════════════════════════════════════════════════════════════╗');
  console.error('║  🛑  BLOCKED: prisma migrate dev against non-local database    ║');
  console.error('╚════════════════════════════════════════════════════════════════╝');
  console.error(`\n  DATABASE_URL host:  ${host}`);
  console.error(`  Expected host:      one of ${SAFE_HOSTS.join(', ')}\n`);
  console.error('  `prisma migrate dev` can RESET the schema (DESTROYING ALL DATA)');
  console.error('  when it detects drift. It must never run against production.\n');
  console.error('  What you probably want instead:');
  console.error('    • Local dev:    create backend/.env.development with a localhost URL');
  console.error('    • Production:   `npx prisma migrate deploy` (non-destructive)\n');
  process.exit(1);
}

console.log(`✅ Safety check passed — DATABASE_URL points to "${host}"`);
