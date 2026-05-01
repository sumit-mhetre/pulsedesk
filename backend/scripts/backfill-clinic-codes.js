// One-time backfill script -- assigns CLN001, CLN002, ... to existing clinics
// that don't have a code yet.
//
// Idempotent: running multiple times won't re-assign codes already set.
//
// Usage:
//   cd E:\Project\pulsedesk\backend
//   node scripts/backfill-clinic-codes.js

require('dotenv').config({ path: process.env.NODE_ENV === 'production' ? '.env' : '.env.development' })
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Looking for clinics without a code...')

  // Find clinics with code = null, oldest first
  const without = await prisma.clinic.findMany({
    where: { code: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, createdAt: true },
  })

  if (without.length === 0) {
    console.log('✅ All clinics already have codes. Nothing to do.')
    return
  }

  // Find highest existing code number to continue numbering
  const allWithCode = await prisma.clinic.findMany({
    where: { code: { not: null } },
    select: { code: true },
  })
  let maxSeq = 0
  for (const c of allWithCode) {
    const m = (c.code || '').match(/^CLN(\d+)$/)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > maxSeq) maxSeq = n
    }
  }

  console.log(`📋 Found ${without.length} clinic(s) without code.`)
  console.log(`📊 Highest existing code is CLN${String(maxSeq).padStart(3, '0')}`)
  console.log('')

  for (const c of without) {
    maxSeq += 1
    const code = 'CLN' + String(maxSeq).padStart(3, '0')
    await prisma.clinic.update({
      where: { id: c.id },
      data: { code },
    })
    console.log(`  ✓ ${code}  -  ${c.name}`)
  }

  console.log('')
  console.log('✅ Backfill complete.')
}

main()
  .catch((e) => {
    console.error('❌ Backfill failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
