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

  // ── 3. Clinic Admin (Doctor) ───────────────────────────
  const existingAdmin = await prisma.user.findUnique({
    where: { clinicId_email: { clinicId: clinic.id, email: 'admin@sharmaclinic.com' } },
  })

  if (!existingAdmin) {
    const hashed = await bcrypt.hash('password123', 12)
    await prisma.user.create({
      data: {
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

  // ── 4. Doctor 2 ────────────────────────────────────────
  const existingDoctor = await prisma.user.findUnique({
    where: { clinicId_email: { clinicId: clinic.id, email: 'doctor@sharmaclinic.com' } },
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

  // ── 5. Receptionist ────────────────────────────────────
  const existingRecp = await prisma.user.findUnique({
    where: { clinicId_email: { clinicId: clinic.id, email: 'reception@sharmaclinic.com' } },
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

  // ── 6. Default Dosage Options ──────────────────────────
  const dosageCount = await prisma.dosageOption.count({ where: { clinicId: clinic.id } })
  if (dosageCount === 0) {
    await prisma.dosageOption.createMany({
      data: [
        { clinicId: clinic.id, code: '1-0-0',   label: 'Once daily (Morning)',           timesPerDay: 1 },
        { clinicId: clinic.id, code: '0-1-0',   label: 'Once daily (Afternoon)',         timesPerDay: 1 },
        { clinicId: clinic.id, code: '0-0-1',   label: 'Once daily (Night)',             timesPerDay: 1 },
        { clinicId: clinic.id, code: '1-0-1',   label: 'Twice daily (Morning & Night)',  timesPerDay: 2 },
        { clinicId: clinic.id, code: '1-1-0',   label: 'Twice daily (Morning & Afternoon)', timesPerDay: 2 },
        { clinicId: clinic.id, code: '1-1-1',   label: 'Thrice daily',                  timesPerDay: 3 },
        { clinicId: clinic.id, code: '1-1-1-1', label: 'Four times daily',              timesPerDay: 4 },
        { clinicId: clinic.id, code: 'SOS',     label: 'As needed (SOS)',               timesPerDay: null },
        { clinicId: clinic.id, code: 'OD',      label: 'Once daily (OD)',               timesPerDay: 1 },
        { clinicId: clinic.id, code: 'BD',      label: 'Twice daily (BD)',              timesPerDay: 2 },
        { clinicId: clinic.id, code: 'TDS',     label: 'Thrice daily (TDS)',            timesPerDay: 3 },
        { clinicId: clinic.id, code: 'QID',     label: 'Four times daily (QID)',        timesPerDay: 4 },
        { clinicId: clinic.id, code: 'HS',      label: 'At bedtime (HS)',               timesPerDay: 1 },
      ],
    })
    console.log('✅ Dosage options seeded')
  }

  // ── 7. Default Timing Options ──────────────────────────
  const timingCount = await prisma.timingOption.count({ where: { clinicId: clinic.id } })
  if (timingCount === 0) {
    await prisma.timingOption.createMany({
      data: [
        { clinicId: clinic.id, code: 'AF',  labelEn: 'After Food',      labelHi: 'खाने के बाद',      labelMr: 'जेवणानंतर' },
        { clinicId: clinic.id, code: 'BF',  labelEn: 'Before Food',     labelHi: 'खाने से पहले',     labelMr: 'जेवणापूर्वी' },
        { clinicId: clinic.id, code: 'ES',  labelEn: 'Empty Stomach',   labelHi: 'खाली पेट',         labelMr: 'रिकाम्या पोटी' },
        { clinicId: clinic.id, code: 'WM',  labelEn: 'With Milk',       labelHi: 'दूध के साथ',       labelMr: 'दुधासोबत' },
        { clinicId: clinic.id, code: 'WW',  labelEn: 'With Water',      labelHi: 'पानी के साथ',      labelMr: 'पाण्यासोबत' },
        { clinicId: clinic.id, code: 'WFW', labelEn: 'With Warm Water', labelHi: 'गर्म पानी के साथ', labelMr: 'कोमट पाण्यासोबत' },
        { clinicId: clinic.id, code: 'HS',  labelEn: 'At Bedtime',      labelHi: 'सोते समय',         labelMr: 'झोपताना' },
        { clinicId: clinic.id, code: 'MO',  labelEn: 'Morning Only',    labelHi: 'सुबह',             labelMr: 'सकाळी' },
        { clinicId: clinic.id, code: 'AN',  labelEn: 'At Night',        labelHi: 'रात को',           labelMr: 'रात्री' },
      ],
    })
    console.log('✅ Timing options seeded')
  }

  // ── 8. Default Billing Items ───────────────────────────
  const billCount = await prisma.billingItem.count({ where: { clinicId: clinic.id } })
  if (billCount === 0) {
    await prisma.billingItem.createMany({
      data: [
        { clinicId: clinic.id, name: 'Consultation Fee — General',    defaultPrice: 300, category: 'Consultation' },
        { clinicId: clinic.id, name: 'Consultation Fee — Follow Up',  defaultPrice: 150, category: 'Consultation' },
        { clinicId: clinic.id, name: 'Consultation Fee — Pediatric',  defaultPrice: 350, category: 'Consultation' },
        { clinicId: clinic.id, name: 'Consultation Fee — Emergency',  defaultPrice: 500, category: 'Consultation' },
        { clinicId: clinic.id, name: 'Dressing — Simple',             defaultPrice: 100, category: 'Procedure' },
        { clinicId: clinic.id, name: 'Dressing — Complex',            defaultPrice: 250, category: 'Procedure' },
        { clinicId: clinic.id, name: 'IV Injection',                  defaultPrice: 200, category: 'Injection' },
        { clinicId: clinic.id, name: 'IM Injection',                  defaultPrice: 100, category: 'Injection' },
        { clinicId: clinic.id, name: 'Nebulisation',                  defaultPrice: 200, category: 'Procedure' },
        { clinicId: clinic.id, name: 'ECG',                           defaultPrice: 250, category: 'Diagnostic' },
        { clinicId: clinic.id, name: 'Blood Sugar (Glucometer)',       defaultPrice: 50,  category: 'Diagnostic' },
        { clinicId: clinic.id, name: 'Bed Charges (per day)',          defaultPrice: 500, category: 'Bed' },
      ],
    })
    console.log('✅ Billing items seeded')
  }

  console.log('\n🎉 Seeding complete!\n')
  console.log('─────────────────────────────────────────')
  console.log('📋 LOGIN CREDENTIALS')
  console.log('─────────────────────────────────────────')
  console.log(`Super Admin:  super@pulsedesk.com / superadmin123`)
  console.log(`Clinic ID:    ${clinic.id}`)
  console.log(`Admin:        admin@sharmaclinic.com / password123`)
  console.log(`Doctor:       doctor@sharmaclinic.com / password123`)
  console.log(`Receptionist: reception@sharmaclinic.com / password123`)
  console.log('─────────────────────────────────────────\n')
}

main()
  .catch((e) => { console.error('Seed error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
