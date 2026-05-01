// Consents controller — track admission, surgery, anesthesia, and other
// consent forms per admission.
//
// Pre-loaded standard consent text templates. Patient acknowledges, paper
// scan can be uploaded as documentUrl. v1 doesn't enforce mandatory
// consents — it's tracking + audit only.
//
// Permission gates set in routes:
//   read   → manageIPD
//   write  → manageConsents (Admin, Doctor, Receptionist)

const prisma = require('../../lib/prisma')
const { successResponse, errorResponse } = require('../../lib/response')

const VALID_TYPES = [
  'ADMISSION', 'SURGERY', 'ANESTHESIA', 'BLOOD_TRANSFUSION',
  'HIGH_RISK', 'HIV_TEST', 'PHOTOGRAPHY', 'OTHER',
]

// Standard consent text templates (English). Clinics can override `consentText`
// per consent record. These are the defaults shown in the form.
const CONSENT_TEMPLATES = {
  ADMISSION: `I voluntarily consent to admission and hospital treatment at this facility. I understand the nature of my condition and the proposed treatment. I authorize the medical staff to perform necessary diagnostic procedures, administer medications, and provide medical care as deemed necessary by the attending physician. I agree to abide by the rules and regulations of the hospital.`,
  SURGERY: `I, the undersigned, voluntarily consent to the surgical procedure planned by the attending surgeon. The nature, purpose, risks, and alternatives of the procedure have been explained to me in language I understand. I acknowledge that no guarantees have been made regarding the outcome. I authorize the surgeon to perform such additional procedures as may be necessary in the surgeon's judgment during the operation.`,
  ANESTHESIA: `I consent to the administration of anesthesia (general / spinal / local / regional, as appropriate) by the anesthesiologist. The risks and complications of anesthesia, including but not limited to allergic reactions, breathing difficulties, and rare serious complications, have been explained to me. I have disclosed all known allergies and current medications.`,
  BLOOD_TRANSFUSION: `I consent to the transfusion of blood and/or blood products as required during the course of my treatment. The risks of transfusion, including transfusion reactions and transmission of infectious diseases (despite screening), have been explained to me. I understand the alternatives available.`,
  HIGH_RISK: `I am informed that my medical condition involves higher than usual risk. I have been counselled regarding the risks, benefits, and alternatives of the proposed treatment. I voluntarily accept the elevated risk and consent to proceed.`,
  HIV_TEST: `I voluntarily consent to undergo testing for HIV. I have received pre-test counselling and understand that my result will remain confidential. Post-test counselling will be provided regardless of result.`,
  PHOTOGRAPHY: `I consent to clinical photography of my condition for medical record, education, or research purposes. I understand that my identity will be protected and images will only be used in accordance with applicable privacy regulations.`,
  OTHER: '',
}

async function loadAdmission(req, res, allowClosed = false) {
  const admission = await prisma.admission.findFirst({
    where: { id: req.params.admissionId, clinicId: req.clinicId },
  })
  if (!admission) {
    errorResponse(res, 'Admission not found', 404)
    return null
  }
  if (!allowClosed && admission.status !== 'ADMITTED') {
    errorResponse(res, 'Cannot modify a closed admission', 400)
    return null
  }
  return admission
}

// ── Get template text for a consent type ──────────────────
// Returns the default consent text the user can edit before saving.
async function getTemplate(req, res) {
  try {
    const { type } = req.query
    if (!type || !VALID_TYPES.includes(type)) {
      return errorResponse(res, 'type is required and must be a valid consent type', 400)
    }
    return successResponse(res, {
      type,
      template: CONSENT_TEMPLATES[type] || '',
    })
  } catch (err) {
    console.error('[getTemplate]', err)
    return errorResponse(res, 'Failed to fetch template', 500)
  }
}

// ── List consents for an admission ────────────────────────
async function listConsents(req, res) {
  try {
    const admission = await loadAdmission(req, res, true)
    if (!admission) return

    const consents = await prisma.consent.findMany({
      where: { admissionId: admission.id },
      orderBy: { createdAt: 'desc' },
    })
    return successResponse(res, consents)
  } catch (err) {
    console.error('[listConsents]', err)
    return errorResponse(res, 'Failed to fetch consents', 500)
  }
}

// ── Create consent ────────────────────────────────────────
// Body: { consentType, signedByPatient, patientSignDate, signedByWitness,
//         witnessName, witnessSignDate, documentUrl, consentText, notes }
async function createConsent(req, res) {
  try {
    const admission = await loadAdmission(req, res, true)
    if (!admission) return

    const {
      consentType, signedByPatient = false, patientSignDate,
      signedByWitness = false, witnessName, witnessSignDate,
      documentUrl, consentText, notes,
    } = req.body

    if (!consentType || !VALID_TYPES.includes(consentType)) {
      return errorResponse(res, 'Invalid consent type', 400)
    }

    const consent = await prisma.consent.create({
      data: {
        admissionId:     admission.id,
        consentType,
        signedByPatient: !!signedByPatient,
        patientSignDate: patientSignDate ? new Date(patientSignDate) : null,
        signedByWitness: !!signedByWitness,
        witnessName:     witnessName?.trim() || null,
        witnessSignDate: witnessSignDate ? new Date(witnessSignDate) : null,
        documentUrl:     documentUrl?.trim() || null,
        consentText:     consentText?.trim() || CONSENT_TEMPLATES[consentType] || null,
        notes:           notes?.trim() || null,
      },
    })

    return successResponse(res, consent, 'Consent recorded', 201)
  } catch (err) {
    console.error('[createConsent]', err)
    return errorResponse(res, 'Failed to record consent', 500)
  }
}

// ── Update consent ────────────────────────────────────────
async function updateConsent(req, res) {
  try {
    const consent = await prisma.consent.findFirst({
      where: { id: req.params.id, admission: { clinicId: req.clinicId } },
    })
    if (!consent) return errorResponse(res, 'Consent not found', 404)

    const {
      signedByPatient, patientSignDate,
      signedByWitness, witnessName, witnessSignDate,
      documentUrl, consentText, notes,
    } = req.body

    const data = {}
    if (signedByPatient !== undefined) data.signedByPatient = !!signedByPatient
    if (patientSignDate !== undefined) data.patientSignDate = patientSignDate ? new Date(patientSignDate) : null
    if (signedByWitness !== undefined) data.signedByWitness = !!signedByWitness
    if (witnessName     !== undefined) data.witnessName     = witnessName?.trim() || null
    if (witnessSignDate !== undefined) data.witnessSignDate = witnessSignDate ? new Date(witnessSignDate) : null
    if (documentUrl     !== undefined) data.documentUrl     = documentUrl?.trim() || null
    if (consentText     !== undefined) data.consentText     = consentText?.trim() || null
    if (notes           !== undefined) data.notes           = notes?.trim() || null

    const updated = await prisma.consent.update({
      where: { id: consent.id },
      data,
    })
    return successResponse(res, updated, 'Consent updated')
  } catch (err) {
    console.error('[updateConsent]', err)
    return errorResponse(res, 'Failed to update', 500)
  }
}

// ── Delete consent ────────────────────────────────────────
async function deleteConsent(req, res) {
  try {
    const consent = await prisma.consent.findFirst({
      where: { id: req.params.id, admission: { clinicId: req.clinicId } },
    })
    if (!consent) return errorResponse(res, 'Consent not found', 404)
    await prisma.consent.delete({ where: { id: consent.id } })
    return successResponse(res, null, 'Consent deleted')
  } catch (err) {
    console.error('[deleteConsent]', err)
    return errorResponse(res, 'Failed to delete', 500)
  }
}

module.exports = {
  getTemplate,
  listConsents,
  createConsent,
  updateConsent,
  deleteConsent,
  CONSENT_TEMPLATES,
}
