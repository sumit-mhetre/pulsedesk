// Single source of truth for RBAC permissions.
// Roles set defaults; user.permissions holds overrides only (keeps DB clean).

// 14 granular permissions. Keep keys stable — they're stored in DB + sent to frontend.
const PERMISSION_KEYS = [
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
  'viewDocuments',     // see fitness/medical certs + referrals
  'createDocuments',   // issue new certs/referrals
];

// Role defaults. Pure data — resolvePermissions() merges these with per-user overrides.
const ROLE_DEFAULTS = {
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
};

// Guarantee every key is present for every role (fail-closed if new key added without updating defaults)
function getDefaultsForRole(role) {
  const defaults = ROLE_DEFAULTS[role] || {};
  const filled = {};
  for (const k of PERMISSION_KEYS) filled[k] = defaults[k] === true;
  return filled;
}

// Merge: role defaults <- user overrides. Returns flat { key: bool } object.
function resolvePermissions(user) {
  if (!user) return {};
  const defaults = getDefaultsForRole(user.role);
  const overrides = (user.permissions && typeof user.permissions === 'object') ? user.permissions : {};
  const result = { ...defaults };
  for (const k of PERMISSION_KEYS) {
    if (typeof overrides[k] === 'boolean') result[k] = overrides[k];
  }
  return result;
}

// Shortcut used by middleware + inside controllers.
function userCan(user, permissionKey) {
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;  // SuperAdmin bypasses all app-level permission checks
  const resolved = resolvePermissions(user);
  return resolved[permissionKey] === true;
}

// Sanitize input from PUT /users/:id — drop unknown keys, coerce to bool.
// Only stores KEYS THAT DIFFER from role defaults → keeps permissions JSON minimal.
function sanitizeOverrides(role, incoming) {
  if (!incoming || typeof incoming !== 'object') return {};
  const defaults = getDefaultsForRole(role);
  const overrides = {};
  for (const k of PERMISSION_KEYS) {
    if (typeof incoming[k] === 'boolean' && incoming[k] !== defaults[k]) {
      overrides[k] = incoming[k];
    }
  }
  return overrides;
}

module.exports = {
  PERMISSION_KEYS,
  ROLE_DEFAULTS,
  getDefaultsForRole,
  resolvePermissions,
  userCan,
  sanitizeOverrides,
};
