// scripts/reset-admin-password.js
// Standalone password reset utility — run on server (or locally against prod DB) when
// you're locked out and can't log in to trigger the forgot-password flow.
//
// Usage:
//   node scripts/reset-admin-password.js <email> <newPassword>
//
// Examples:
//   node scripts/reset-admin-password.js admin@sharmaclinic.com password123
//   node scripts/reset-admin-password.js super@pulsedesk.com superadmin123
//
// - Matches email case-insensitively (trims whitespace).
// - Checks both SuperAdmin and User tables automatically.
// - Invalidates all refresh tokens for the account (forces re-login).
// - Does NOT delete or affect any other data.

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  const [, , emailArg, newPassword] = process.argv

  if (!emailArg || !newPassword) {
    console.error('')
    console.error('Usage: node scripts/reset-admin-password.js <email> <newPassword>')
    console.error('')
    console.error('Example:')
    console.error('  node scripts/reset-admin-password.js admin@sharmaclinic.com password123')
    console.error('')
    process.exit(1)
  }

  if (newPassword.length < 6) {
    console.error('❌ New password must be at least 6 characters.')
    process.exit(1)
  }

  const email = emailArg.trim().toLowerCase()
  const hashed = await bcrypt.hash(newPassword, 12)

  // Try SuperAdmin first
  const superAdmin = await prisma.superAdmin.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  })

  if (superAdmin) {
    await prisma.superAdmin.update({
      where: { id: superAdmin.id },
      data:  { password: hashed },
    })
    console.log('')
    console.log(`✅ SUPER ADMIN password reset successfully`)
    console.log(`   Email:    ${superAdmin.email}`)
    console.log(`   Name:     ${superAdmin.name}`)
    console.log(`   Password: ${newPassword}`)
    console.log('')
    return
  }

  // Otherwise try User
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    include: { clinic: { select: { name: true, status: true } } },
  })

  if (!user) {
    console.error('')
    console.error(`❌ No account found with email: ${email}`)
    console.error('')
    console.error('Available accounts:')
    const allUsers = await prisma.user.findMany({
      select: { email: true, role: true, isActive: true, clinic: { select: { name: true } } },
      take: 20,
    })
    const allSupers = await prisma.superAdmin.findMany({ select: { email: true } })
    allSupers.forEach(s => console.error(`  SUPER_ADMIN   ${s.email}`))
    allUsers.forEach(u => console.error(`  ${u.role.padEnd(13)} ${u.email}  ${u.isActive ? '' : '(inactive)'}  [${u.clinic?.name || '-'}]`))
    console.error('')
    process.exit(1)
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { password: hashed, isActive: true } }),
    prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
  ])

  console.log('')
  console.log(`✅ User password reset successfully`)
  console.log(`   Email:    ${user.email}`)
  console.log(`   Name:     ${user.name}`)
  console.log(`   Role:     ${user.role}`)
  console.log(`   Clinic:   ${user.clinic?.name || '-'} (${user.clinic?.status || '-'})`)
  console.log(`   Password: ${newPassword}`)
  console.log(`   isActive: forced to true`)
  console.log(`   All existing sessions invalidated.`)
  console.log('')
}

main()
  .catch(err => { console.error('Error:', err); process.exit(1) })
  .finally(() => prisma.$disconnect())
