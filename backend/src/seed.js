require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding PulseDesk database...\n')

  // ── 1. Super Admin ─────────────────────────────────────
  const existingSuper = await prisma.superAdmin.findFirst()
  let superAdmin

  if (!existingSuper) {
    const hashed = await bcrypt.hash('superadmin123', 12)
    superAdmin = await prisma.superAdmin.create({
      data: { name: 'Super Admin', email: 'super@pulsedesk.com', password: hashed },
    })
    console.log('✅ Super Admin created')
    console.log(`   Email: super@pulsedesk.com`)
    console.log(`   Password: superadmin123\n`)
  } else {
    superAdmin = existingSuper
    console.log('ℹ️  Super Admin already exists\n')
  }

  // ── 2. Demo Clinic ─────────────────────────────────────
  let clinic = await prisma.clinic.findFirst({ where: { name: 'Sharma Medical Clinic' } })

  if (!clinic) {
    clinic = await prisma.clinic.create({
      data: {
        name: 'Sharma Medical Clinic',
        address: 'Shop No. 5, Ganesh Nagar, Near Bus Stand, Pune - 411001',
        phone: '020-27654321',
        mobile: '9876543210',
        email: 'sharmaclinic@gmail.com',
        tagline: 'Your Health, Our Priority',
        subscriptionPlan: 'Pro',
        status: 'Active',
      },
    })
    console.log('✅ Demo Clinic created')
    console.log(`   Clinic ID: ${clinic.id}\n`)
  } else {
    console.log('ℹ️  Demo Clinic already exists')
    console.log(`   Clinic ID: ${clinic.id}\n`)
  }

  // ── 3. Clinic Admin ───────────────────────────
  const existingAdmin = await prisma.user.findFirst({
    where: {
      clinicId: clinic.id,
      email: 'admin@sharmaclinic.com'
    }
  })

const hashed = await bcrypt.hash('password123', 12)

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
    qualification: 'MBBS, MD (General Medicine)',
    specialization: 'General Physician',
    regNo: 'MH-12345',
    permissions: {},
  },
})
    console.log('✅ Admin/Doctor created')
    console.log(`   Email: admin@sharmaclinic.com`)
    console.log(`   Password: password123\n`)
  } else {
    console.log('ℹ️  Admin user already exists\n')
  }

  // ── 4. Doctor ───────────────────────────
  const existingDoctor = await prisma.user.findFirst({
    where: {
      clinicId: clinic.id,
      email: 'doctor@sharmaclinic.com'
    }
  })

  if (!existingDoctor) {
    const hashed = await bcrypt.hash('password123', 12)
    await prisma.user.create({
      data: {
        clinicId: clinic.id,
        name: 'Dr. Priya Joshi',
        email: 'doctor@sharmaclinic.com',
        password: hashed,
        role: 'DOCTOR',
        phone: '9765432109',
        qualification: 'MBBS, DCH',
        specialization: 'Pediatrician',
        regNo: 'MH-67890',
        permissions: {},
      },
    })
    console.log('✅ Doctor created')
    console.log(`   Email: doctor@sharmaclinic.com`)
    console.log(`   Password: password123\n`)
  }

  // ── 5. Receptionist ───────────────────────────
  const existingRecp = await prisma.user.findFirst({
    where: {
      clinicId: clinic.id,
      email: 'reception@sharmaclinic.com'
    }
  })

  if (!existingRecp) {
    const hashed = await bcrypt.hash('password123', 12)
    await prisma.user.create({
      data: {
        clinicId: clinic.id,
        name: 'Sneha Patil',
        email: 'reception@sharmaclinic.com',
        password: hashed,
        role: 'RECEPTIONIST',
        phone: '9654321098',
        permissions: {},
      },
    })
    console.log('✅ Receptionist created')
    console.log(`   Email: reception@sharmaclinic.com`)
    console.log(`   Password: password123\n`)
  }

  // ── 6. Dosage Options ───────────────────────────
  const dosageCount = await prisma.dosageOption.count({ where: { clinicId: clinic.id } })
  if (dosageCount === 0) {
    await prisma.dosageOption.createMany({
      data: [
        { clinicId: clinic.id, code: '1-0-0', label: 'Once daily (Morning)', timesPerDay: 1 },
        { clinicId: clinic.id, code: '1-1-1', label: 'Thrice daily', timesPerDay: 3 },
        { clinicId: clinic.id, code: 'SOS', label: 'As needed', timesPerDay: null },
      ],
    })
    console.log('✅ Dosage options seeded')
  }

  // ── 7. Timing Options ───────────────────────────
  const timingCount = await prisma.timingOption.count({ where: { clinicId: clinic.id } })
  if (timingCount === 0) {
    await prisma.timingOption.createMany({
      data: [
        { clinicId: clinic.id, code: 'AF', labelEn: 'After Food' },
        { clinicId: clinic.id, code: 'BF', labelEn: 'Before Food' },
      ],
    })
    console.log('✅ Timing options seeded')
  }

  // ── 8. Billing ───────────────────────────
  const billCount = await prisma.billingItem.count({ where: { clinicId: clinic.id } })
  if (billCount === 0) {
    await prisma.billingItem.createMany({
      data: [
        { clinicId: clinic.id, name: 'Consultation Fee', defaultPrice: 300, category: 'Consultation' },
      ],
    })
    console.log('✅ Billing items seeded')
  }

  console.log('\n🎉 Seeding complete!\n')
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())