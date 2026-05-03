#!/usr/bin/env node
/**
 * Safety guard - prevents `prisma migrate dev` from ever running
 * against a non-local database. Run before `prisma migrate dev`.
 *
 * This exists because `migrate dev` detects drift and will reset the
 * schema (destroying all data) with a single "yes" confirmation.
 * If DATABASE_URL points to production, that's catastrophic.
 *
 * Called automatically via the `migrate` npm script (see package.json).
 *
 * IMPORTANT: This script must use the SAME env file that the next command
 * (prisma migrate dev) will use. We force `.env.development` here AND in
 * the prisma command (via dotenv-cli) so they stay in sync.
 */

const path = require('path');
const fs   = require('fs');

// Force load .env.development - this is what prisma will also use
const envDevPath = path.resolve(__dirname, '..', '.env.development');

if (!fs.existsSync(envDevPath)) {
  console.error('\n╔════════════════════════════════════════════════════════════════╗');
  console.error('║  🛑  BLOCKED: .env.development file not found                  ║');
  console.error('╚════════════════════════════════════════════════════════════════╝');
  console.error(`\n  Expected: ${envDevPath}`);
  console.error('  This file must contain a localhost DATABASE_URL.');
  console.error('  Local migrations will not run without it.\n');
  process.exit(1);
}

require('dotenv').config({ path: envDevPath });

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
  console.error('  Check the contents of backend/.env.development\n');
  process.exit(1);
}

console.log(`✅ Safety check passed - DATABASE_URL points to "${host}"`);
console.log(`   Using env file: .env.development\n`);

