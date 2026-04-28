// Standard test field templates for common Indian lab tests.
// Values used to pre-populate LabTest.expectedFields when seeding master data.
//
// Reference ranges are general adult values (mixed gender). Doctors interpret based on
// patient context — we just show ranges as hints, never auto-flag.

const LAB_TEST_TEMPLATES = {
  'Complete Blood Count (CBC)': {
    category: 'Haematology',
    fields: [
      { key: 'hemoglobin',      label: 'Hb',                      unit: 'g/dL',     normalLow: 13,    normalHigh: 17 },
      { key: 'totalWBC',        label: 'Total WBC Count',         unit: '/μL',      normalLow: 4000,  normalHigh: 11000 },
      { key: 'rbc',             label: 'RBC Count',               unit: 'million/μL', normalLow: 4.5, normalHigh: 5.5 },
      { key: 'platelets',       label: 'Platelets',               unit: '/μL',      normalLow: 150000, normalHigh: 410000 },
      { key: 'pcv',             label: 'Haematocrit (PCV)',       unit: '%',        normalLow: 40,    normalHigh: 50 },
      { key: 'mcv',             label: 'MCV',                     unit: 'fL',       normalLow: 80,    normalHigh: 100 },
      { key: 'mch',             label: 'MCH',                     unit: 'pg',       normalLow: 27,    normalHigh: 33 },
      { key: 'mchc',            label: 'MCHC',                    unit: 'g/dL',     normalLow: 32,    normalHigh: 36 },
      { key: 'neutrophils',     label: 'Neutrophils',             unit: '%',        normalLow: 40,    normalHigh: 75 },
      { key: 'lymphocytes',     label: 'Lymphocytes',             unit: '%',        normalLow: 20,    normalHigh: 45 },
      { key: 'eosinophils',     label: 'Eosinophils',             unit: '%',        normalLow: 1,     normalHigh: 6 },
      { key: 'monocytes',       label: 'Monocytes',               unit: '%',        normalLow: 2,     normalHigh: 10 },
      { key: 'basophils',       label: 'Basophils',               unit: '%',        normalLow: 0,     normalHigh: 2 },
      { key: 'esr',             label: 'ESR',                     unit: 'mm/hour',  normalLow: 0,     normalHigh: 20 },
    ],
  },

  'Lipid Profile': {
    category: 'Bio Chemistry',
    fields: [
      { key: 'totalCholesterol', label: 'Total Cholesterol',     unit: 'mg/dL', normalLow: 0,   normalHigh: 200 },
      { key: 'hdl',              label: 'HDL Cholesterol',       unit: 'mg/dL', normalLow: 40,  normalHigh: 60 },
      { key: 'ldl',              label: 'LDL Cholesterol',       unit: 'mg/dL', normalLow: 0,   normalHigh: 100 },
      { key: 'vldl',             label: 'VLDL Cholesterol',      unit: 'mg/dL', normalLow: 5,   normalHigh: 40 },
      { key: 'triglycerides',    label: 'Triglycerides',         unit: 'mg/dL', normalLow: 0,   normalHigh: 150 },
      { key: 'cholHdlRatio',     label: 'Total Chol/HDL Ratio',  unit: '',      normalLow: 0,   normalHigh: 4.5 },
      { key: 'nonHdl',           label: 'Non-HDL Cholesterol',   unit: 'mg/dL', normalLow: 0,   normalHigh: 130 },
    ],
  },

  'Liver Function Test (LFT)': {
    category: 'Bio Chemistry',
    fields: [
      { key: 'totalBilirubin',    label: 'Total Bilirubin',       unit: 'mg/dL',  normalLow: 0.1, normalHigh: 1.2 },
      { key: 'directBilirubin',   label: 'Direct Bilirubin',      unit: 'mg/dL',  normalLow: 0,   normalHigh: 0.3 },
      { key: 'indirectBilirubin', label: 'Indirect Bilirubin',    unit: 'mg/dL',  normalLow: 0,   normalHigh: 0.9 },
      { key: 'sgpt',              label: 'SGPT (ALT)',            unit: 'U/L',    normalLow: 0,   normalHigh: 45 },
      { key: 'sgot',              label: 'SGOT (AST)',            unit: 'U/L',    normalLow: 0,   normalHigh: 40 },
      { key: 'alkPhos',           label: 'Alkaline Phosphatase',  unit: 'U/L',    normalLow: 40,  normalHigh: 130 },
      { key: 'totalProtein',      label: 'Total Protein',         unit: 'g/dL',   normalLow: 6.4, normalHigh: 8.3 },
      { key: 'albumin',           label: 'Albumin',               unit: 'g/dL',   normalLow: 3.5, normalHigh: 5.0 },
      { key: 'globulin',          label: 'Globulin',              unit: 'g/dL',   normalLow: 2.0, normalHigh: 3.5 },
      { key: 'agRatio',           label: 'A/G Ratio',             unit: '',       normalLow: 1.0, normalHigh: 2.5 },
    ],
  },

  'Kidney Function Test (KFT)': {
    category: 'Bio Chemistry',
    fields: [
      { key: 'bloodUrea',         label: 'Blood Urea',            unit: 'mg/dL',  normalLow: 15,  normalHigh: 45 },
      { key: 'bun',               label: 'Blood Urea Nitrogen',   unit: 'mg/dL',  normalLow: 7,   normalHigh: 20 },
      { key: 'serumCreatinine',   label: 'Serum Creatinine',      unit: 'mg/dL',  normalLow: 0.6, normalHigh: 1.3 },
      { key: 'sodium',            label: 'Sodium (Na+)',          unit: 'mEq/L',  normalLow: 136, normalHigh: 145 },
      { key: 'potassium',         label: 'Potassium (K+)',        unit: 'mEq/L',  normalLow: 3.5, normalHigh: 5.1 },
      { key: 'chloride',          label: 'Chloride (Cl-)',        unit: 'mEq/L',  normalLow: 98,  normalHigh: 107 },
      { key: 'uricAcid',          label: 'Uric Acid',             unit: 'mg/dL',  normalLow: 3.5, normalHigh: 7.2 },
      { key: 'serumCalcium',      label: 'Serum Calcium',         unit: 'mg/dL',  normalLow: 8.5, normalHigh: 10.5 },
      { key: 'egfr',              label: 'eGFR',                  unit: 'mL/min/1.73m²', normalLow: 90, normalHigh: null },
    ],
  },

  'Thyroid Function Test (TFT)': {
    category: 'Bio Chemistry',
    fields: [
      { key: 'tsh',     label: 'TSH',           unit: 'µIU/mL',  normalLow: 0.4, normalHigh: 4.0 },
      { key: 't3',      label: 'Total T3',      unit: 'ng/dL',   normalLow: 80,  normalHigh: 200 },
      { key: 't4',      label: 'Total T4',      unit: 'µg/dL',   normalLow: 5,   normalHigh: 12 },
      { key: 'freeT3',  label: 'Free T3',       unit: 'pg/mL',   normalLow: 2.0, normalHigh: 4.4 },
      { key: 'freeT4',  label: 'Free T4',       unit: 'ng/dL',   normalLow: 0.8, normalHigh: 1.8 },
    ],
  },

  'Random Blood Sugar (RBS)': {
    category: 'Bio Chemistry',
    fields: [
      { key: 'rbs', label: 'RBS', unit: 'mg/dL', normalLow: 70, normalHigh: 140 },
    ],
  },

  'Fasting Blood Sugar (FBS)': {
    category: 'Bio Chemistry',
    fields: [
      { key: 'fbs', label: 'FBS', unit: 'mg/dL', normalLow: 70, normalHigh: 100 },
    ],
  },

  'Post Prandial Blood Sugar (PPBS)': {
    category: 'Bio Chemistry',
    fields: [
      { key: 'ppbs', label: 'PPBS (2 hr)', unit: 'mg/dL', normalLow: 70, normalHigh: 140 },
    ],
  },

  'HbA1c': {
    category: 'Bio Chemistry',
    fields: [
      { key: 'hba1c',           label: 'HbA1c',                  unit: '%',      normalLow: 4.0, normalHigh: 5.6 },
      { key: 'avgGlucose',      label: 'Estimated Avg Glucose',  unit: 'mg/dL',  normalLow: 70,  normalHigh: 126 },
    ],
  },

  'Urine Routine': {
    category: 'Pathology',
    fields: [
      { key: 'colour',          label: 'Colour',           unit: '',     normalLow: null, normalHigh: null },
      { key: 'appearance',      label: 'Appearance',       unit: '',     normalLow: null, normalHigh: null },
      { key: 'specificGravity', label: 'Specific Gravity', unit: '',     normalLow: 1.005, normalHigh: 1.030 },
      { key: 'ph',              label: 'pH',               unit: '',     normalLow: 5.0, normalHigh: 7.5 },
      { key: 'protein',         label: 'Protein',          unit: '',     normalLow: null, normalHigh: null },
      { key: 'glucose',         label: 'Glucose',          unit: '',     normalLow: null, normalHigh: null },
      { key: 'ketones',         label: 'Ketones',          unit: '',     normalLow: null, normalHigh: null },
      { key: 'pusCells',        label: 'Pus Cells',        unit: '/HPF', normalLow: 0,   normalHigh: 5 },
      { key: 'rbcCells',        label: 'RBC',              unit: '/HPF', normalLow: 0,   normalHigh: 2 },
      { key: 'epithelialCells', label: 'Epithelial Cells', unit: '/HPF', normalLow: 0,   normalHigh: 5 },
    ],
  },
};

// Convenience: get template for a name (case-insensitive partial match)
function findTemplate(testName) {
  if (!testName) return null;
  const lower = testName.toLowerCase().trim();
  // Exact match first
  for (const [key, val] of Object.entries(LAB_TEST_TEMPLATES)) {
    if (key.toLowerCase() === lower) return val;
  }
  // Partial — checks whether the key is contained in the testName or vice-versa
  for (const [key, val] of Object.entries(LAB_TEST_TEMPLATES)) {
    const kLower = key.toLowerCase();
    if (lower.includes(kLower) || kLower.includes(lower)) return val;
  }
  return null;
}

module.exports = { LAB_TEST_TEMPLATES, findTemplate };
