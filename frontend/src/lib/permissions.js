// Mirrors backend src/lib/permissions.js. Keys must stay in sync.

export const PERMISSION_KEYS = [
  'viewDashboard',
  'managePatients',
  'manageQueue',
  'viewPrescriptions',
  'createPrescriptions',
  'viewBilling',
  'createBilling',
  'viewReports',
  'manageTemplates',
  'manageMasterData',
  'loadDefaultMasterData',
  'manageSettings',
  'manageUsers',
  'viewDocuments',
  'createDocuments',
  // ── IPD permissions ──
  'manageIPD',
  'manageBeds',
  'manageAdmissions',
  'recordRoundNotes',
  'recordIPDVitals',
  'recordNursingNotes',
  'manageMedicationOrders',
  'recordMAR',
  'manageIPDOrders',
  'recordIntakeOutput',
  'manageConsents',
  'manageConsultations',
  'manageIPDBilling',
  'manageBillingPackages',
  'dischargePatient',
]

export const PERMISSION_LABELS = {
  viewDashboard:         'View Dashboard',
  managePatients:        'Manage Patients',
  manageQueue:           'Manage Queue',
  viewPrescriptions:     'View Prescriptions',
  createPrescriptions:   'Create / Edit Prescriptions',
  viewBilling:           'View Billing',
  createBilling:         'Create / Edit Bills',
  viewReports:           'View Reports',
  manageTemplates:       'Manage Templates',
  manageMasterData:      'Manage Master Data',
  loadDefaultMasterData: 'Load Default Master Data',
  manageSettings:        'Manage Settings',
  manageUsers:           'Manage Users',
  viewDocuments:         'View Certificates',
  createDocuments:       'Create / Edit Certificates',
  // ── IPD ──
  manageIPD:                'Access IPD Module',
  manageBeds:               'Manage Beds (Allocate / Transfer)',
  manageAdmissions:         'Admit & Manage Patients',
  recordRoundNotes:         'Record Doctor Round Notes',
  recordIPDVitals:          'Record IPD Vitals',
  recordNursingNotes:       'Record Nursing Notes',
  manageMedicationOrders:   'Order Inpatient Medications',
  recordMAR:                'Record Medication Administration (MAR)',
  manageIPDOrders:          'Place IPD Orders (Lab / Imaging / Diet)',
  recordIntakeOutput:       'Record Intake / Output',
  manageConsents:           'Manage Consent Forms',
  manageConsultations:      'Manage Cross-Specialty Consultations',
  manageIPDBilling:         'Manage IPD Charges & Bills',
  manageBillingPackages:    'Manage Billing Packages',
  dischargePatient:         'Discharge Patients',
}

// Grouping for the admin UI checkboxes
export const PERMISSION_GROUPS = [
  {
    label: 'Clinical',
    keys: ['viewDashboard','managePatients','manageQueue','viewPrescriptions','createPrescriptions','viewDocuments','createDocuments','viewReports','manageTemplates'],
  },
  {
    label: 'Billing',
    keys: ['viewBilling','createBilling'],
  },
  {
    label: 'Administration',
    keys: ['manageMasterData','loadDefaultMasterData','manageSettings','manageUsers'],
  },
  {
    label: 'Inpatient (IPD)',
    keys: [
      'manageIPD','manageBeds','manageAdmissions',
      'recordRoundNotes','recordIPDVitals','recordNursingNotes',
      'manageMedicationOrders','recordMAR','manageIPDOrders','recordIntakeOutput',
      'manageConsents','manageConsultations','manageIPDBilling','manageBillingPackages',
      'dischargePatient',
    ],
  },
]

export const ROLE_DEFAULTS = {
  ADMIN: {
    viewDashboard: true,  managePatients: true,   manageQueue: true,
    viewPrescriptions: true, createPrescriptions: true,
    viewBilling: true,    createBilling: true,
    viewReports: true,    manageTemplates: true,
    manageMasterData: true, loadDefaultMasterData: true,
    manageSettings: true, manageUsers: true,
    viewDocuments: true,  createDocuments: true,
    // IPD — admins get all
    manageIPD: true, manageBeds: true, manageAdmissions: true,
    recordRoundNotes: true, recordIPDVitals: true, recordNursingNotes: true,
    manageMedicationOrders: true, recordMAR: true, manageIPDOrders: true,
    recordIntakeOutput: true, manageConsents: true, manageConsultations: true,
    manageIPDBilling: true, manageBillingPackages: true, dischargePatient: true,
  },
  DOCTOR: {
    viewDashboard: true,  managePatients: true,   manageQueue: true,
    viewPrescriptions: true, createPrescriptions: true,
    viewBilling: true,    createBilling: true,
    viewReports: true,    manageTemplates: true,
    manageMasterData: true, loadDefaultMasterData: false,
    manageSettings: true, manageUsers: false,
    viewDocuments: true,  createDocuments: true,
    // IPD — doctors get clinical + admin functions, not nursing-specific
    manageIPD: true, manageBeds: true, manageAdmissions: true,
    recordRoundNotes: true, recordIPDVitals: true, recordNursingNotes: false,
    manageMedicationOrders: true, recordMAR: false, manageIPDOrders: true,
    recordIntakeOutput: true, manageConsents: true, manageConsultations: true,
    manageIPDBilling: true, manageBillingPackages: false, dischargePatient: true,
  },
  RECEPTIONIST: {
    viewDashboard: true,  managePatients: true,   manageQueue: true,
    // Read-only access to prescriptions: receptionist can view/print Rx for
    // billing/handover but cannot create or edit them (createPrescriptions=false).
    viewPrescriptions: true, createPrescriptions: false,
    viewBilling: true,    createBilling: true,
    viewReports: false,   manageTemplates: false,
    manageMasterData: false, loadDefaultMasterData: false,
    manageSettings: false, manageUsers: false,
    viewDocuments: false, createDocuments: false,
    // IPD — receptionists handle admission paperwork + billing
    manageIPD: true, manageBeds: true, manageAdmissions: true,
    recordRoundNotes: false, recordIPDVitals: false, recordNursingNotes: false,
    manageMedicationOrders: false, recordMAR: false, manageIPDOrders: false,
    recordIntakeOutput: false, manageConsents: true, manageConsultations: false,
    manageIPDBilling: true, manageBillingPackages: false, dischargePatient: false,
  },
  NURSE: {
    // OPD permissions — minimal access
    viewDashboard: true,  managePatients: false,  manageQueue: false,
    viewPrescriptions: true, createPrescriptions: false,
    viewBilling: false,   createBilling: false,
    viewReports: false,   manageTemplates: false,
    manageMasterData: false, loadDefaultMasterData: false,
    manageSettings: false, manageUsers: false,
    viewDocuments: false, createDocuments: false,
    // IPD — nursing core duties
    manageIPD: true, manageBeds: false, manageAdmissions: false,
    recordRoundNotes: false, recordIPDVitals: true, recordNursingNotes: true,
    manageMedicationOrders: false, recordMAR: true, manageIPDOrders: false,
    recordIntakeOutput: true, manageConsents: false, manageConsultations: false,
    manageIPDBilling: false, manageBillingPackages: false, dischargePatient: false,
  },
}

export function getDefaultsForRole(role) {
  const defaults = ROLE_DEFAULTS[role] || {}
  const filled = {}
  for (const k of PERMISSION_KEYS) filled[k] = defaults[k] === true
  return filled
}

// Resolves effective permissions for a user — role defaults + per-user overrides.
// Always returns a full flat object with all keys.
export function resolvePermissions(user) {
  if (!user) return {}
  const defaults = getDefaultsForRole(user.role)
  const overrides = user.permissions && typeof user.permissions === 'object' ? user.permissions : {}
  const out = { ...defaults }
  for (const k of PERMISSION_KEYS) {
    if (typeof overrides[k] === 'boolean') out[k] = overrides[k]
  }
  return out
}

// Shortcut check. Accepts user object; SUPER_ADMIN always true.
export function can(user, permissionKey) {
  if (!user) return false
  if (user.role === 'SUPER_ADMIN') return true
  // Backend already resolves and sends `permissions` as a flat map on login/me response
  if (user.permissions && typeof user.permissions[permissionKey] === 'boolean') {
    return user.permissions[permissionKey]
  }
  // Fallback to role defaults if for some reason backend didn't send flat permissions
  return resolvePermissions(user)[permissionKey] === true
}

// For the edit-user form: returns the list of override keys (those differing from role defaults).
// Sent back to backend on save — keeps DB clean.
export function computeOverrides(role, fullPermissions) {
  const defaults = getDefaultsForRole(role)
  const overrides = {}
  for (const k of PERMISSION_KEYS) {
    if (typeof fullPermissions[k] === 'boolean' && fullPermissions[k] !== defaults[k]) {
      overrides[k] = fullPermissions[k]
    }
  }
  return overrides
}
