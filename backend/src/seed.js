require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding PulseDesk database...\n')

  // ── 1. Super Admin ─────────────────────────────
  const existingSuper = await prisma.superAdmin.findFirst()

  if (!existingSuper) {
    const hashed = await bcrypt.hash('superadmin123', 12)
    await prisma.superAdmin.create({
      data: {
        name: 'Super Admin',
        email: 'super@pulsedesk.com',
        password: hashed
      }
    })
    console.log('✅ Super Admin created')
  } else {
    console.log('ℹ️ Super Admin already exists')
  }

  // ── 2. Clinic ─────────────────────────────
  let clinic = await prisma.clinic.findFirst({
    where: { name: 'Sharma Medical Clinic' }
  })

  if (!clinic) {
    clinic = await prisma.clinic.create({
      data: {
        name: 'Sharma Medical Clinic',
        address: 'Pune',
        phone: '020-27654321',
        mobile: '9876543210',
        email: 'sharmaclinic@gmail.com',
        tagline: 'Your Health, Our Priority',
        subscriptionPlan: 'Pro',
        status: 'Active'
      }
    })
    console.log('✅ Clinic created')
  } else {
    console.log('ℹ️ Clinic already exists')
  }

  const hashed = await bcrypt.hash('password123', 12)

  // ── 3. Admin (UPsert) ─────────────────────────────
  await prisma.user.upsert({
    where: { email: 'admin@sharmaclinic.com' },
    update: { password: hashed },
    create: {
      clinicId: clinic.id,
      name: 'Dr. Rajesh Sharma',
      email: 'admin@sharmaclinic.com',
      password: hashed,
      role: 'ADMIN',
      phone: '9876543210',
      qualification: 'MBBS, MD',
      specialization: 'General Physician',
      regNo: 'MH-12345',
      permissions: {}
    }
  })
  console.log('✅ Admin ready')

  // ── 4. Doctor ─────────────────────────────
  await prisma.user.upsert({
    where: { email: 'doctor@sharmaclinic.com' },
    update: { password: hashed },
    create: {
      clinicId: clinic.id,
      name: 'Dr. Priya Joshi',
      email: 'doctor@sharmaclinic.com',
      password: hashed,
      role: 'DOCTOR',
      phone: '9765432109',
      qualification: 'MBBS',
      specialization: 'Pediatrician',
      regNo: 'MH-67890',
      permissions: {}
    }
  })
  console.log('✅ Doctor ready')

  // ── 5. Receptionist ─────────────────────────────
  await prisma.user.upsert({
    where: { email: 'reception@sharmaclinic.com' },
    update: { password: hashed },
    create: {
      clinicId: clinic.id,
      name: 'Sneha Patil',
      email: 'reception@sharmaclinic.com',
      password: hashed,
      role: 'RECEPTIONIST',
      phone: '9654321098',
      permissions: {}
    }
  })
  console.log('✅ Receptionist ready')

  console.log('\n🎉 Seeding complete!\n')
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())