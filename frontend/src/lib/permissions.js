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
  'manageSettings',
  'manageUsers',
  'viewDocuments',
  'createDocuments',
]

export const PERMISSION_LABELS = {
  viewDashboard:       'View Dashboard',
  managePatients:      'Manage Patients',
  manageQueue:         'Manage Queue',
  viewPrescriptions:   'View Prescriptions',
  createPrescriptions: 'Create / Edit Prescriptions',
  viewBilling:         'View Billing',
  createBilling:       'Create / Edit Bills',
  viewReports:         'View Reports',
  manageTemplates:     'Manage Templates',
  manageMasterData:    'Manage Master Data',
  manageSettings:      'Manage Settings',
  manageUsers:         'Manage Users',
  viewDocuments:       'View Certificates',
  createDocuments:     'Create / Edit Certificates',
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
    keys: ['manageMasterData','manageSettings','manageUsers'],
  },
]

export const ROLE_DEFAULTS = {
  ADMIN: {
    viewDashboard: true,  managePatients: true,   manageQueue: true,
    viewPrescriptions: true, createPrescriptions: true,
    viewBilling: true,    createBilling: true,
    viewReports: true,    manageTemplates: true,
    manageMasterData: true, manageSettings: true, manageUsers: true,
    viewDocuments: true,  createDocuments: true,
  },
  DOCTOR: {
    viewDashboard: true,  managePatients: true,   manageQueue: true,
    viewPrescriptions: true, createPrescriptions: true,
    viewBilling: true,    createBilling: true,
    viewReports: true,    manageTemplates: true,
    manageMasterData: true, manageSettings: true, manageUsers: false,
    viewDocuments: true,  createDocuments: true,
  },
  RECEPTIONIST: {
    viewDashboard: true,  managePatients: true,   manageQueue: true,
    viewPrescriptions: false, createPrescriptions: false,
    viewBilling: true,    createBilling: true,
    viewReports: false,   manageTemplates: false,
    manageMasterData: false, manageSettings: false, manageUsers: false,
    viewDocuments: false, createDocuments: false,
  },
}

export function getDefaultsForRole(role) {
  const defaults = ROLE_DEFAULTS[role] || {}
  const filled = {}
  for (const k of PERMISSION_KEYS) filled[k] = defaults[k] === true
  return filled
}

// Resolves effective permissions for a user — role defaults + per-user overrides.
// Always returns a full flat object with all 14 keys.
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
