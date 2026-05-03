/**
 * One-time script to reset the super admin password in LOCAL DB.
 * Useful when you forget the local super admin password.
 *
 * Usage:  npm run reset-super-local
 * (or:    dotenv -e .env.development -- node scripts/reset-super-local.js)
 *
 * After running, login with:
 *   email:    super@pulsedesk.com
 *   password: super123
 */

const path = require('path');

// Force load .env.development - never touch production with this script
const envDevPath = path.resolve(__dirname, '..', '.env.development');
require('dotenv').config({ path: envDevPath });

const url = process.env.DATABASE_URL || '';
const hostMatch = url.match(/@([^:/?]+)(?::\d+)?\//);
const host = hostMatch ? hostMatch[1] : '(unknown)';

const SAFE_HOSTS = ['localhost', '127.0.0.1', '::1'];
if (!SAFE_HOSTS.includes(host)) {
  console.error(`\n🛑 Refusing to run - DATABASE_URL host is "${host}", not localhost.`);
  console.error('   This script is for local development only.\n');
  process.exit(1);
}

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const NEW_EMAIL    = 'super@pulsedesk.com';
const NEW_PASSWORD = 'super123';

(async () => {
  try {
    console.log(`✅ Connected to local DB at "${host}"`);

    const existing = await prisma.superAdmin.findFirst();
    const hashed = await bcrypt.hash(NEW_PASSWORD, 12);

    if (existing) {
      const updated = await prisma.superAdmin.update({
        where: { id: existing.id },
        data: {
          email: NEW_EMAIL,
          password: hashed,
          name: existing.name || 'Super Admin',
        },
      });
      console.log(`✅ Updated existing super admin (id: ${updated.id})`);
    } else {
      const created = await prisma.superAdmin.create({
        data: { name: 'Super Admin', email: NEW_EMAIL, password: hashed },
      });
      console.log(`✅ Created new super admin (id: ${created.id})`);
    }

    console.log('');
    console.log('You can now login at http://localhost:5173/login with:');
    console.log(`   Email:    ${NEW_EMAIL}`);
    console.log(`   Password: ${NEW_PASSWORD}`);
    console.log('');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
