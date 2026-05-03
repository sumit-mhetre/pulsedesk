// Shared filter logic for the per-doctor data privacy feature.
//
// Each piece of "personal workflow" data (prescription templates, complaints,
// diagnoses, advice options) carries an optional userId field tagging the
// creator. When a clinic-level "share*" toggle is OFF (the privacy-first
// default), each doctor only sees:
//   - rows they themselves created (userId === me), AND
//   - legacy rows with no creator tag (userId IS NULL) - existing data.
// When the toggle is ON, all doctors in the clinic see all rows.
// Admins always see everything regardless.
//
// Returns a Prisma `where` fragment that callers spread into their existing
// where clause:
//
//   const where = {
//     clinicId: req.clinicId,
//     ...privacyWhere(req, clinic.shareTemplates),
//     ...other filters,
//   };
//
// Pass clinic from a single SELECT before the main query (or include it in
// the auth middleware later for caching).

const prisma = require('./prisma');

/**
 * Returns the additional `where` clause needed to enforce the privacy filter.
 * If `shared` is true, returns {} (no filter, everyone sees everything).
 * If user is ADMIN, returns {} (admin override).
 * Otherwise restricts to userId === me OR userId === null.
 */
function privacyWhere(req, shared) {
  if (shared) return {};
  const user = req?.user;
  if (!user) return {};
  if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return {};
  return {
    OR: [
      { userId: user.id },
      { userId: null },
    ],
  };
}

/**
 * Returns true if the user is allowed to mutate (edit/delete) a row owned by
 * `rowUserId`. Owner can mutate; admins can mutate anything; legacy null-owned
 * rows are mutable by anyone in the clinic (preserves old behaviour).
 */
function canMutate(req, rowUserId) {
  const user = req?.user;
  if (!user) return false;
  if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return true;
  if (rowUserId == null) return true; // legacy shared
  return rowUserId === user.id;
}

/**
 * Doctor-scoped privacy filter for tables with a `doctorId` field
 * (Prescription, Appointment). Used for Phase 3+4 of the privacy feature.
 *
 * If `shared` is true, no filter (everyone in clinic sees all).
 * If user is ADMIN or RECEPTIONIST or NURSE, no filter (cross-doctor visibility
 *   needed for their roles - admin oversight, receptionist booking + bills,
 *   nurse handles patients across doctors).
 * Otherwise (DOCTOR), restricts to:
 *   - rows where doctorId === me, AND OPTIONALLY
 *   - rows where doctorId IS NULL (legacy / unassigned).
 *
 * `allowNull` defaults to true. Pass false for tables where doctorId is a
 * required (non-nullable) column - Prisma rejects `{doctorId: null}` queries
 * on non-nullable fields. Prescription.doctorId is non-nullable, so the
 * prescription controller calls this with allowNull=false.
 */
function doctorPrivacyWhere(req, shared, { allowNull = true } = {}) {
  if (shared) return {};
  const user = req?.user;
  if (!user) return {};
  // Roles that always bypass doctor-scoped filtering
  if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return {};
  if (user.role === 'RECEPTIONIST' || user.role === 'NURSE') return {};
  if (allowNull) {
    return {
      OR: [
        { doctorId: user.id },
        { doctorId: null },
      ],
    };
  }
  // Non-nullable doctorId column: just filter to user's own. There are no
  // legacy null rows to consider.
  return { doctorId: user.id };
}

/**
 * Loads the clinic's sharing flags. Cached per-request to avoid repeat
 * lookups within a single controller. Caller passes req.
 */
async function getClinicSharingFlags(req) {
  if (req._clinicSharingFlags) return req._clinicSharingFlags;
  const clinic = await prisma.clinic.findUnique({
    where: { id: req.clinicId },
    select: {
      shareAppointments: true,
      sharePrescriptions: true,
      shareTemplates: true,
      shareMasterData: true,
    },
  });
  req._clinicSharingFlags = clinic || {
    shareAppointments: false,
    sharePrescriptions: false,
    shareTemplates: false,
    shareMasterData: false,
  };
  return req._clinicSharingFlags;
}

module.exports = { privacyWhere, doctorPrivacyWhere, canMutate, getClinicSharingFlags };
