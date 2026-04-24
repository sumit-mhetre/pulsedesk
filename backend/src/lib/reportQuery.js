// Flexible report query engine.
// Translates a config object into a Prisma query, executes, formats rows.
//
// Config shape:
// {
//   type: 'patients' | 'prescriptions' | 'bills' | 'appointments',
//   dateRange: { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' } | null,
//   filters: { doctorId, gender, paymentStatus, ageMin, ageMax, search, ... },
//   columns: string[]  // subset of AVAILABLE_COLUMNS[type]
//   groupBy: 'day' | 'week' | 'month' | 'doctor' | 'diagnosis' | 'medicine' | null,
//   sortBy: string,
//   sortDir: 'asc' | 'desc',
//   page: number, pageSize: number
// }

const prisma = require('./prisma');
const { startOfDay, endOfDay } = require('./dates');

// ── Column definitions ────────────────────────────────────
// Maps UI column key → { label, path to value, formatter, type }
const COLUMNS = {
  patients: {
    patientCode:       { label: 'Code',              get: (p) => p.patientCode },
    name:              { label: 'Name',              get: (p) => [p.prefix, p.name].filter(Boolean).join(' ') },
    age:               { label: 'Age',               get: (p) => p.age ?? '', type: 'number' },
    gender:            { label: 'Gender',            get: (p) => p.gender },
    phone:             { label: 'Phone',             get: (p) => p.phone || '' },
    email:             { label: 'Email',             get: (p) => p.email || '' },
    address:           { label: 'Address',           get: (p) => p.address || '' },
    bloodGroup:        { label: 'Blood Group',       get: (p) => p.bloodGroup || '' },
    allergies:         { label: 'Allergies',         get: (p) => (p.allergies || []).join(', ') },
    chronicConditions: { label: 'Chronic',           get: (p) => (p.chronicConditions || []).join(', ') },
    createdAt:         { label: 'Registered',        get: (p) => p.createdAt, type: 'date' },
    totalVisits:       { label: 'Total Visits',      get: (p) => p._count?.prescriptions ?? 0, type: 'number' },
    totalBills:        { label: 'Total Bills',       get: (p) => p._count?.bills ?? 0, type: 'number' },
  },
  prescriptions: {
    rxNo:         { label: 'Rx No',        get: (x) => x.rxNo },
    date:         { label: 'Date',         get: (x) => x.date, type: 'date' },
    patientName:  { label: 'Patient',      get: (x) => x.patient?.name || '' },
    patientCode:  { label: 'Patient Code', get: (x) => x.patient?.patientCode || '' },
    patientAge:   { label: 'Age',          get: (x) => x.patient?.age ?? '', type: 'number' },
    patientPhone: { label: 'Phone',        get: (x) => x.patient?.phone || '' },
    doctorName:   { label: 'Doctor',       get: (x) => x.doctor?.name || '' },
    complaint:    { label: 'Complaint',    get: (x) => x.complaint || '' },
    diagnosis:    { label: 'Diagnosis',    get: (x) => x.diagnosis || '' },
    advice:       { label: 'Advice',       get: (x) => x.advice || '' },
    medicines:    { label: 'Medicines',    get: (x) => (x.medicines || []).map(m => m.medicineName).join(', ') },
    labTests:     { label: 'Lab Tests',    get: (x) => (x.labTests || []).map(l => l.labTestName).join(', ') },
    nextVisit:    { label: 'Next Visit',   get: (x) => x.nextVisit, type: 'date' },
  },
  bills: {
    billNo:         { label: 'Bill No',        get: (b) => b.billNo },
    date:           { label: 'Date',           get: (b) => b.date, type: 'date' },
    patientName:    { label: 'Patient',        get: (b) => b.patient?.name || '' },
    patientCode:    { label: 'Patient Code',   get: (b) => b.patient?.patientCode || '' },
    patientPhone:   { label: 'Phone',          get: (b) => b.patient?.phone || '' },
    subtotal:       { label: 'Subtotal',       get: (b) => b.subtotal,    type: 'currency' },
    discount:       { label: 'Discount',       get: (b) => b.discount,    type: 'currency' },
    total:          { label: 'Total',          get: (b) => b.total,       type: 'currency' },
    amountPaid:     { label: 'Paid',           get: (b) => b.amountPaid,  type: 'currency' },
    balance:        { label: 'Balance',        get: (b) => b.balance,     type: 'currency' },
    paymentMode:    { label: 'Payment Mode',   get: (b) => b.paymentMode },
    paymentStatus:  { label: 'Status',         get: (b) => b.paymentStatus },
    itemCount:      { label: 'Items',          get: (b) => b.items?.length || 0, type: 'number' },
  },
  appointments: {
    tokenNo:       { label: 'Token',      get: (a) => a.tokenNo,    type: 'number' },
    tokenDate:     { label: 'Date',       get: (a) => a.tokenDate,  type: 'date' },
    patientName:   { label: 'Patient',    get: (a) => a.patient?.name || '' },
    patientCode:   { label: 'Patient Code',get:(a) => a.patient?.patientCode || '' },
    patientPhone:  { label: 'Phone',      get: (a) => a.patient?.phone || '' },
    doctorName:    { label: 'Doctor',     get: (a) => a.doctor?.name || '' },
    status:        { label: 'Status',     get: (a) => a.status },
    notes:         { label: 'Notes',      get: (a) => a.notes || '' },
    createdAt:     { label: 'Created',    get: (a) => a.createdAt, type: 'date' },
  },
};

function listAvailableColumns(type) {
  const set = COLUMNS[type];
  if (!set) return [];
  return Object.entries(set).map(([key, meta]) => ({ key, label: meta.label, type: meta.type || 'string' }));
}

// ── Filter builder ─────────────────────────────────────────
function buildWhere(type, clinicId, dateRange, filters = {}, currentUser = null) {
  const where = { clinicId };
  const dateField = {
    patients:      'createdAt',
    prescriptions: 'date',
    bills:         'date',
    appointments:  'tokenDate',
  }[type];

  if (dateRange?.from || dateRange?.to) {
    where[dateField] = {};
    if (dateRange.from) where[dateField].gte = startOfDay(new Date(dateRange.from));
    if (dateRange.to)   where[dateField].lte = endOfDay(new Date(dateRange.to));
  }

  // Doctor scoping — if role DOCTOR, restrict to own patients/prescriptions/appointments
  const isRestricted = currentUser && currentUser.role === 'DOCTOR';
  if (isRestricted && type !== 'patients') {
    where.doctorId = currentUser.id;
  }

  if (filters.doctorId && !isRestricted) {
    where.doctorId = filters.doctorId;
  }

  if (filters.gender && type === 'patients') {
    where.gender = filters.gender;
  }

  if ((filters.ageMin != null || filters.ageMax != null) && type === 'patients') {
    where.age = {};
    if (filters.ageMin != null) where.age.gte = Number(filters.ageMin);
    if (filters.ageMax != null) where.age.lte = Number(filters.ageMax);
  }

  if (filters.paymentStatus && type === 'bills') {
    where.paymentStatus = filters.paymentStatus;
  }

  if (filters.paymentMode && type === 'bills') {
    where.paymentMode = filters.paymentMode;
  }

  if (filters.amountMin != null && type === 'bills') {
    where.total = { ...(where.total || {}), gte: Number(filters.amountMin) };
  }
  if (filters.amountMax != null && type === 'bills') {
    where.total = { ...(where.total || {}), lte: Number(filters.amountMax) };
  }

  if (filters.appointmentStatus && type === 'appointments') {
    where.status = filters.appointmentStatus;
  }

  if (filters.diagnosis && type === 'prescriptions') {
    where.diagnosis = { contains: filters.diagnosis, mode: 'insensitive' };
  }

  // Full-text search (patient side)
  if (filters.search && filters.search.length >= 2) {
    const term = filters.search;
    const patientMatch = {
      OR: [
        { name:        { contains: term, mode: 'insensitive' } },
        { patientCode: { contains: term, mode: 'insensitive' } },
        { phone:       { contains: term } },
      ],
    };
    if (type === 'patients') {
      where.OR = patientMatch.OR;
    } else {
      where.patient = patientMatch;
    }
  }

  return where;
}

// ── Prisma model + includes for each type ─────────────────
function getIncludes(type) {
  switch (type) {
    case 'patients':
      return { _count: { select: { prescriptions: true, bills: true, appointments: true } } };
    case 'prescriptions':
      return {
        patient:   { select: { name: true, patientCode: true, age: true, gender: true, phone: true } },
        doctor:    { select: { name: true } },
        medicines: { select: { medicineName: true } },
        labTests:  { select: { labTestName: true } },
      };
    case 'bills':
      return {
        patient: { select: { name: true, patientCode: true, phone: true } },
        items:   { select: { id: true } },
      };
    case 'appointments':
      return {
        patient: { select: { name: true, patientCode: true, phone: true, age: true, gender: true } },
      };
  }
}

function getSortField(type, sortBy) {
  // Map UI sort keys → Prisma sort paths
  const defaults = { patients: 'createdAt', prescriptions: 'date', bills: 'date', appointments: 'tokenDate' };
  const fallback = defaults[type];
  if (!sortBy) return { [fallback]: 'desc' };

  // Direct column fields
  const directMap = {
    patients: ['patientCode','name','age','gender','createdAt'],
    prescriptions: ['rxNo','date','nextVisit'],
    bills: ['billNo','date','total','amountPaid','balance','paymentStatus'],
    appointments: ['tokenNo','tokenDate','status','createdAt'],
  };
  if ((directMap[type] || []).includes(sortBy)) return sortBy;
  return fallback;
}

// ── Main query ─────────────────────────────────────────────
async function runReportQuery(config, clinicId, currentUser) {
  const {
    type,
    dateRange = null,
    filters = {},
    columns,
    sortBy, sortDir = 'desc',
    page = 1, pageSize = 50,
    // full = false → paginate; true → all rows (for exports, capped)
    full = false,
  } = config;

  if (!COLUMNS[type]) throw new Error(`Unknown report type: ${type}`);

  const where = buildWhere(type, clinicId, dateRange, filters, currentUser);
  const sortField = getSortField(type, sortBy);
  const orderBy = (typeof sortField === 'string')
    ? { [sortField]: sortDir === 'asc' ? 'asc' : 'desc' }
    : sortField;

  const includes = getIncludes(type);
  const model = prisma[{
    patients: 'patient',
    prescriptions: 'prescription',
    bills: 'bill',
    appointments: 'appointment',
  }[type]];

  const take  = full ? Math.min(Number(pageSize) || 10000, 10000) : (Number(pageSize) || 50);
  const skip  = full ? 0 : Math.max(0, (Number(page) - 1) * take);

  const [total, rows] = await Promise.all([
    model.count({ where }),
    model.findMany({ where, include: includes, orderBy, skip, take }),
  ]);

  // Project to requested columns
  const availableKeys = Object.keys(COLUMNS[type]);
  const cols = (Array.isArray(columns) && columns.length)
    ? columns.filter(c => availableKeys.includes(c))
    : availableKeys.slice(0, 8);

  const projected = rows.map(row => {
    const out = { _raw: row };
    cols.forEach(key => {
      const def = COLUMNS[type][key];
      out[key] = def ? def.get(row) : null;
    });
    return out;
  });

  const columnsMeta = cols.map(key => ({ key, ...COLUMNS[type][key] })).map(({ get, ...rest }) => rest);

  // Compute summary (type-specific)
  const summary = computeSummary(type, rows);

  return { total, page: Number(page), pageSize: take, rows: projected, columns: columnsMeta, summary };
}

// ── Summary computation ────────────────────────────────────
function computeSummary(type, rows) {
  if (!rows.length) return {};

  switch (type) {
    case 'patients': {
      const byGender = rows.reduce((a, r) => {
        a[r.gender] = (a[r.gender] || 0) + 1;
        return a;
      }, {});
      const avgAge = Math.round(rows.reduce((s, r) => s + (r.age || 0), 0) / rows.filter(r => r.age).length || 0);
      return { total: rows.length, byGender, avgAge };
    }
    case 'prescriptions': {
      const uniquePatients = new Set(rows.map(r => r.patientId)).size;
      const diagnoses = {};
      rows.forEach(r => {
        if (r.diagnosis) (r.diagnosis || '').split(/[,;]/).map(d => d.trim()).filter(Boolean).forEach(d => {
          diagnoses[d] = (diagnoses[d] || 0) + 1;
        });
      });
      const topDiagnoses = Object.entries(diagnoses).sort((a, b) => b[1] - a[1]).slice(0, 5);
      return { total: rows.length, uniquePatients, topDiagnoses };
    }
    case 'bills': {
      const totalBilled    = rows.reduce((s, b) => s + (b.total || 0), 0);
      const totalCollected = rows.reduce((s, b) => s + (b.amountPaid || 0), 0);
      const totalPending   = rows.reduce((s, b) => s + (b.balance || 0), 0);
      const byMode = {};
      rows.forEach(b => { byMode[b.paymentMode] = (byMode[b.paymentMode] || 0) + (b.amountPaid || 0); });
      const byStatus = {};
      rows.forEach(b => { byStatus[b.paymentStatus] = (byStatus[b.paymentStatus] || 0) + 1; });
      const avg = rows.length ? totalBilled / rows.length : 0;
      return { total: rows.length, totalBilled, totalCollected, totalPending, byMode, byStatus, avg };
    }
    case 'appointments': {
      const byStatus = {};
      rows.forEach(a => { byStatus[a.status] = (byStatus[a.status] || 0) + 1; });
      return { total: rows.length, byStatus };
    }
  }
  return { total: rows.length };
}

module.exports = {
  COLUMNS,
  listAvailableColumns,
  runReportQuery,
  computeSummary,
};
