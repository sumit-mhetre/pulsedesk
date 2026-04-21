const prisma = require('../lib/prisma');
const { successResponse, errorResponse } = require('../lib/response');

// Default config for prescription
const DEFAULT_RX_CONFIG = {
  // Paper
  paperSize: 'A4',          // A4 | A5 | half
  // Header
  showClinicName:    true,
  showClinicAddress: true,
  showClinicPhone:   true,
  showClinicTagline: true,
  showDoctorName:    true,
  showDoctorQual:    true,
  showDoctorSpec:    true,
  showDoctorRegNo:   true,
  headerBorder:      true,
  headerColor:       '#1565C0',
  // Patient section
  showPatient:       true,
  showAge:           true,
  showGender:        true,
  showAllergy:       true,
  // Rx fields
  showComplaint:     true,
  showDiagnosis:     true,
  showMedicines:     true,
  showLabTests:      true,
  showAdvice:        true,
  showNextVisit:     true,
  showVitals:        false,
  // Medicine table columns
  showDosage:        true,
  showWhen:          true,
  showDays:          true,
  showQty:           true,
  showNotes:         true,
  // Typography
  fontFamily:        'default',   // default | serif | mono
  baseFontSize:      'md',        // sm | md | lg
  medicineNameBold:  true,
  // Footer
  showSignature:     true,
  showGeneratedBy:   true,
  showRxSymbol:      true,
  // Colors
  primaryColor:      '#1565C0',
  // Rx number style
  showRxNo:          true,
};

const DEFAULT_BILL_CONFIG = {
  paperSize:         'A4',
  showClinicName:    true,
  showClinicAddress: true,
  showClinicPhone:   true,
  showDoctorName:    true,
  showPatient:       true,
  showAge:           true,
  showGender:        true,
  showBillNo:        true,
  showDate:          true,
  showItemName:      true,
  showQty:           true,
  showRate:          true,
  showAmount:        true,
  showSubtotal:      true,
  showDiscount:      true,
  showTotal:         true,
  showPaymentMode:   true,
  showBalance:       true,
  showNotes:         true,
  showSignature:     false,
  headerColor:       '#1565C0',
  primaryColor:      '#1565C0',
  baseFontSize:      'md',
  fontFamily:        'default',
  thankYouMessage:   'Thank you for visiting!',
};

// ── Get design for clinic ─────────────────────────────────
async function getDesign(req, res) {
  try {
    const { type = 'prescription' } = req.query;
    let design = await prisma.pageDesign.findFirst({
      where: { clinicId: req.clinicId, type, isDefault: true },
    });
    if (!design) {
      // Return default config without saving
      const config = type === 'bill' ? DEFAULT_BILL_CONFIG : DEFAULT_RX_CONFIG;
      return successResponse(res, { type, config, isDefault: true, id: null });
    }
    return successResponse(res, design);
  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Failed to fetch design', 500);
  }
}

// ── Save design ───────────────────────────────────────────
async function saveDesign(req, res) {
  try {
    const { type = 'prescription', config } = req.body;

    // Upsert — one design per clinic per type
    const existing = await prisma.pageDesign.findFirst({
      where: { clinicId: req.clinicId, type },
    });

    let design;
    if (existing) {
      design = await prisma.pageDesign.update({
        where: { id: existing.id },
        data: { config, updatedAt: new Date() },
      });
    } else {
      design = await prisma.pageDesign.create({
        data: {
          clinicId:  req.clinicId,
          name:      `${type} default`,
          type,
          isDefault: true,
          config,
        },
      });
    }
    return successResponse(res, design, 'Design saved!');
  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Failed to save design', 500);
  }
}

// ── Reset to defaults ─────────────────────────────────────
async function resetDesign(req, res) {
  try {
    const { type = 'prescription' } = req.query;
    await prisma.pageDesign.deleteMany({ where: { clinicId: req.clinicId, type } });
    const config = type === 'bill' ? DEFAULT_BILL_CONFIG : DEFAULT_RX_CONFIG;
    return successResponse(res, { type, config }, 'Reset to defaults');
  } catch (err) {
    return errorResponse(res, 'Failed to reset', 500);
  }
}

module.exports = { getDesign, saveDesign, resetDesign, DEFAULT_RX_CONFIG, DEFAULT_BILL_CONFIG };
