// Seed script: populate LabTest.expectedFields for tests that don't already
// have them, using templates from src/lib/labTestFields.js.
//
// Behaviour:
//   - For every LabTest row across ALL clinics:
//   - If the test name matches a template (via findTemplate -- supports
//     exact / alias / substring matching) AND expectedFields is null/empty,
//     update the row with template fields.
//   - If a category template is associated, optionally also fix missing
//     test.category (only if currently null, never overwriting).
//   - If expectedFields already has content, SKIP (idempotent -- safe to
//     re-run, manual customizations are preserved).
//
// Run:    node backend/scripts/seed-lab-fields.js
// Re-run: idempotent, only newly added templates / new tests are affected.
//
// Reports counts at the end:
//   - Updated:    rows that got fields populated
//   - Skipped:    rows that already had expectedFields
//   - No match:   rows whose name didn't match any template

const path = require('path')
const { PrismaClient } = require('@prisma/client')
const { findTemplate } = require(path.resolve(__dirname, '..', 'src', 'lib', 'labTestFields'))

const prisma = new PrismaClient()

// Treat existing expectedFields as "populated" only if it's a non-empty array.
// Anything else (null, [], {}, "") counts as empty and gets seeded.
function isEmptyFields(ef) {
  if (ef === null || ef === undefined) return true
  if (!Array.isArray(ef)) return true
  return ef.length === 0
}

async function main() {
  console.log('=== Lab Test Field Seed ===\n')

  const tests = await prisma.labTest.findMany({
    select: { id: true, clinicId: true, name: true, category: true, expectedFields: true },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  })
  console.log(`Found ${tests.length} lab test rows total.\n`)

  let updated   = 0
  let skipped   = 0  // already had expectedFields
  const noMatch = []
  const errors  = []

  for (const t of tests) {
    if (!isEmptyFields(t.expectedFields)) {
      skipped++
      continue
    }

    const tpl = findTemplate(t.name)
    if (!tpl) {
      noMatch.push(`${t.name} (cat: ${t.category || '-'}, clinic: ${t.clinicId.slice(0, 8)})`)
      continue
    }

    // Update only expectedFields. Leave category alone unless it's null
    // and template suggests one. Never overwrite an existing category.
    const updateData = { expectedFields: tpl.fields }
    if (!t.category && tpl.category) {
      updateData.category = tpl.category
    }

    try {
      await prisma.labTest.update({
        where: { id: t.id },
        data:  updateData,
      })
      updated++
      console.log(`  ✓ ${t.name}  (${tpl.fields.length} fields)`)
    } catch (err) {
      errors.push({ name: t.name, message: err.message })
    }
  }

  console.log('\n=== Summary ===')
  console.log(`Updated:    ${updated}`)
  console.log(`Skipped:    ${skipped}  (already had expectedFields)`)
  console.log(`No match:   ${noMatch.length}`)
  console.log(`Errors:     ${errors.length}\n`)

  if (noMatch.length > 0) {
    console.log('--- Tests that did NOT match any template ---')
    console.log('  (These keep their existing free-text-only behaviour. Add')
    console.log('   templates to src/lib/labTestFields.js or set fields via')
    console.log('   Master Data UI to give them structured fields.)')
    console.log()
    for (const n of noMatch) console.log(`  - ${n}`)
    console.log()
  }

  if (errors.length > 0) {
    console.log('--- Errors ---')
    for (const e of errors) console.log(`  ! ${e.name}: ${e.message}`)
    console.log()
  }

  await prisma.$disconnect()
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
