// IPD Dashboard controller -- aggregates IPD stats for the dashboard page.
//
// Returns:
//   - bedStats: counts by status (vacant, occupied, cleaning, blocked, reserved)
//   - admissionStats: today's new admissions, today's discharges, currently admitted
//   - pendingTasks: pending MAR doses (next 4hrs), pending IPD orders, late doses
//   - recentAdmissions: last 10 admissions
//   - admissionsByDoctor: top 5 doctors by current admissions
//   - bedOccupancyTrend: last 7 days of bed occupancy %
//
// Permission: requireIPD('manageIPD')

const prisma = require('../../lib/prisma')
const { successResponse, errorResponse } = require('../../lib/response')

async function getDashboard(req, res) {
  try {
    const clinicId = req.clinicId
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    const next4hrs   = new Date(now.getTime() + 4 * 60 * 60 * 1000)
    const past30min  = new Date(now.getTime() - 30 * 60 * 1000)

    // 1. Bed stats by status
    const bedsRaw = await prisma.bed.groupBy({
      by: ['status'],
      where: { clinicId, isActive: true },
      _count: { _all: true },
    })
    const bedStats = { vacant: 0, occupied: 0, cleaning: 0, blocked: 0, reserved: 0, total: 0 }
    for (const r of bedsRaw) {
      bedStats[r.status.toLowerCase()] = r._count._all
      bedStats.total += r._count._all
    }
    bedStats.occupancyPercent = bedStats.total > 0
      ? Math.round((bedStats.occupied / bedStats.total) * 100)
      : 0

    // 2. Admission stats
    const [admittedNow, todayAdmissions, todayDischarges] = await Promise.all([
      prisma.admission.count({ where: { clinicId, status: 'ADMITTED' } }),
      prisma.admission.count({
        where: {
          clinicId,
          admittedAt: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.admission.count({
        where: {
          clinicId,
          dischargedAt: { gte: todayStart, lte: todayEnd },
          status:       { in: ['DISCHARGED', 'DAMA', 'DEATH'] },
        },
      }),
    ])

    // 3. Pending tasks across all admitted patients
    const [upcomingDoses, lateDoses, pendingIpdOrders] = await Promise.all([
      // Upcoming MAR doses in next 4hrs
      prisma.medicationAdministration.count({
        where: {
          status:        'PENDING',
          scheduledTime: { gte: now, lte: next4hrs },
          order: {
            status: 'ACTIVE',
            admission: { clinicId, status: 'ADMITTED' },
          },
        },
      }),
      // Late doses: scheduled > 30min ago, still pending
      prisma.medicationAdministration.count({
        where: {
          status:        'PENDING',
          scheduledTime: { lt: past30min },
          order: {
            status: 'ACTIVE',
            admission: { clinicId, status: 'ADMITTED' },
          },
        },
      }),
      // IPD orders not yet completed/cancelled
      prisma.iPDOrder.count({
        where: {
          status: { in: ['ORDERED', 'ACKNOWLEDGED', 'IN_PROGRESS'] },
          admission: { clinicId, status: 'ADMITTED' },
        },
      }),
    ])

    // 4. Recent admissions (last 10)
    const recentAdmissions = await prisma.admission.findMany({
      where: { clinicId },
      orderBy: { admittedAt: 'desc' },
      take: 10,
      include: {
        patient:       { select: { id: true, name: true, patientCode: true } },
        bed:           { select: { id: true, bedNumber: true } },
        primaryDoctor: { select: { id: true, name: true } },
      },
    })

    // 5. Admissions by doctor (currently admitted only)
    const byDoctor = await prisma.admission.groupBy({
      by: ['primaryDoctorId'],
      where: { clinicId, status: 'ADMITTED' },
      _count: { _all: true },
      orderBy: { _count: { primaryDoctorId: 'desc' } },
      take: 5,
    })
    const doctorIds = byDoctor.map(d => d.primaryDoctorId)
    const doctors = await prisma.user.findMany({
      where: { id: { in: doctorIds } },
      select: { id: true, name: true, specialization: true },
    })
    const doctorMap = Object.fromEntries(doctors.map(d => [d.id, d]))
    const admissionsByDoctor = byDoctor.map(d => ({
      doctorId: d.primaryDoctorId,
      doctorName: doctorMap[d.primaryDoctorId]?.name || 'Unknown',
      specialization: doctorMap[d.primaryDoctorId]?.specialization || null,
      count: d._count._all,
    }))

    // 6. Last 7 days admissions trend (for chart)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const recent = await prisma.admission.findMany({
      where: {
        clinicId,
        admittedAt: { gte: sevenDaysAgo },
      },
      select: { admittedAt: true, dischargedAt: true },
    })
    // Bucket by date
    const trend = []
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate())
      const dayEnd   = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59)
      const dayLabel = dayStart.toISOString().slice(5, 10)  // MM-DD
      const admitted = recent.filter(a => a.admittedAt >= dayStart && a.admittedAt <= dayEnd).length
      const discharged = recent.filter(a => a.dischargedAt && a.dischargedAt >= dayStart && a.dischargedAt <= dayEnd).length
      trend.push({ date: dayLabel, admitted, discharged })
    }

    return successResponse(res, {
      bedStats,
      admissionStats: {
        admittedNow,
        todayAdmissions,
        todayDischarges,
      },
      pendingTasks: {
        upcomingDoses,
        lateDoses,
        pendingIpdOrders,
      },
      recentAdmissions,
      admissionsByDoctor,
      trend,
    })
  } catch (err) {
    console.error('[getDashboard]', err)
    return errorResponse(res, 'Failed to fetch dashboard data', 500)
  }
}

module.exports = { getDashboard }
