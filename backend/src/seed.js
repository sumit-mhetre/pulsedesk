require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding SimpleRx EMR database...\n')

  // ── 1. Super Admin ─────────────────────────────
 const superHashed = await bcrypt.hash('superadmin123', 12)

await prisma.superAdmin.upsert({
  where: { email: 'super@pulsedesk.com' },
  update: {
    password: superHashed
  },
  create: {
    name: 'Super Admin',
    email: 'super@pulsedesk.com',
    password: superHashed
  }
})

console.log('✅ Super Admin ready')
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

  // ── 4. Default Document Templates (idempotent) ─────────
  const docTemplates = [
    { type: 'FITNESS_CERT', name: 'General fitness — Employment', isDefault: true,
      diagnosis: 'No abnormality detected on physical examination.', remarks: '',
      data: { verdict: 'FIT', fitnessFor: 'Employment', validityMonths: 6, vitals: {} } },
    { type: 'FITNESS_CERT', name: 'Pre-employment fitness', isDefault: false,
      diagnosis: 'Patient is in good general health.',
      remarks: 'Recommended for office / desk-based roles.',
      data: { verdict: 'FIT', fitnessFor: 'Pre-employment', validityMonths: 12, vitals: {} } },
    { type: 'FITNESS_CERT', name: 'Sports fitness — adult', isDefault: false,
      diagnosis: 'Cardiovascular and musculoskeletal exam normal.', remarks: '',
      data: { verdict: 'FIT', fitnessFor: 'Sports', validityMonths: 6, vitals: {} } },
    { type: 'MEDICAL_CERT', name: 'Viral fever — 3 days rest', isDefault: true,
      diagnosis: 'Viral fever with body ache and headache',
      remarks: 'Patient advised bed rest, plenty of fluids, and prescribed medication.',
      data: { defaultRestDays: 3 } },
    { type: 'MEDICAL_CERT', name: 'Acute gastroenteritis — 2 days', isDefault: false,
      diagnosis: 'Acute gastroenteritis',
      remarks: 'Patient advised oral rehydration, light diet, and prescribed medication.',
      data: { defaultRestDays: 2 } },
    { type: 'MEDICAL_CERT', name: 'Migraine / severe headache — 1 day', isDefault: false,
      diagnosis: 'Acute migraine',
      remarks: 'Patient advised rest in a quiet, darkened environment.',
      data: { defaultRestDays: 1 } },
    { type: 'REFERRAL', name: 'Cardiology referral', isDefault: true,
      diagnosis: '', remarks: 'Thanking you for your assistance.',
      data: { referredToSpecialty: 'Cardiologist',
        reasonForReferral: 'Patient presents with chest pain / palpitations requiring specialist evaluation. Kindly advise further management.' } },
    { type: 'REFERRAL', name: 'Orthopedic referral', isDefault: false,
      diagnosis: '', remarks: 'Thanking you.',
      data: { referredToSpecialty: 'Orthopedic Surgeon',
        reasonForReferral: 'Patient with persistent musculoskeletal complaints. Kindly advise further management.' } },
  ]
  for (const t of docTemplates) {
    await prisma.medicalDocumentTemplate.upsert({
      where: { clinicId_type_name: { clinicId: clinic.id, type: t.type, name: t.name } },
      update: {},
      create: { ...t, clinicId: clinic.id },
    })
  }
  console.log('✅ Document templates seeded')

  console.log('\n🎉 Seeding complete!\n')
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())