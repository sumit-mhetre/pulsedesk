// Standard test field templates for common Indian lab/imaging/pathology tests.
// Used by:
//   - backend/scripts/seed-lab-fields.js -- bulk-seeds LabTest.expectedFields
//   - Master Data UI -- shows preview of what fields a test should have
//
// Reference ranges: general adult, mixed gender. Doctors interpret in
// patient context. We display ranges as hints only; never auto-flag.
//
// Each template can declare `aliases` so different naming conventions in
// master data still resolve to the same template (e.g. "Fasting Blood
// Sugar (FBS)" and "Blood Sugar Fasting (BSF)" share fields).

const LAB_TEST_TEMPLATES = {

  // ──────────────────────────────────────────────────────────────────
  // HAEMATOLOGY
  // ──────────────────────────────────────────────────────────────────

  'Complete Blood Count (CBC)': {
    category: 'Haematology',
    aliases: ['CBC', 'Complete Blood Count', 'Hemogram', 'Haemogram'],
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

  'ESR (Erythrocyte Sedimentation Rate)': {
    category: 'Haematology',
    aliases: ['ESR'],
    fields: [
      { key: 'esr', label: 'ESR', unit: 'mm/hour', normalLow: 0, normalHigh: 20 },
    ],
  },

  'Prothrombin Time (PT/INR)': {
    category: 'Haematology',
    aliases: ['PT/INR', 'PT INR', 'PT', 'Prothrombin Time'],
    fields: [
      { key: 'pt',          label: 'Prothrombin Time (PT)',    unit: 'sec', normalLow: 11, normalHigh: 13.5 },
      { key: 'inr',         label: 'INR',                      unit: '',    normalLow: 0.8, normalHigh: 1.2 },
      { key: 'controlPT',   label: 'Control PT',               unit: 'sec', normalLow: 11, normalHigh: 13 },
    ],
  },

  'Prothrombin Time (PT/INR/aPTT)': {
    category: 'Haematology',
    aliases: ['PT/INR/aPTT', 'Coagulation Profile'],
    fields: [
      { key: 'pt',     label: 'Prothrombin Time (PT)', unit: 'sec', normalLow: 11,  normalHigh: 13.5 },
      { key: 'inr',    label: 'INR',                   unit: '',    normalLow: 0.8, normalHigh: 1.2 },
      { key: 'aptt',   label: 'aPTT',                  unit: 'sec', normalLow: 25,  normalHigh: 35 },
      { key: 'control', label: 'Control',              unit: 'sec', normalLow: 11,  normalHigh: 13 },
    ],
  },

  'D-Dimer': {
    category: 'Haematology',
    aliases: ['D Dimer', 'DDimer'],
    fields: [
      { key: 'dDimer', label: 'D-Dimer', unit: 'ng/mL FEU', normalLow: 0, normalHigh: 500 },
    ],
  },

  'Reticulocyte Count': {
    category: 'Haematology',
    aliases: ['Retic Count'],
    fields: [
      { key: 'reticulocyte', label: 'Reticulocyte Count', unit: '%', normalLow: 0.5, normalHigh: 2.5 },
    ],
  },

  'Peripheral Smear': {
    category: 'Haematology',
    aliases: ['PS', 'Peripheral Blood Smear'],
    fields: [
      { key: 'rbcMorphology',     label: 'RBC Morphology',     unit: '', normalLow: null, normalHigh: null },
      { key: 'wbcMorphology',     label: 'WBC Morphology',     unit: '', normalLow: null, normalHigh: null },
      { key: 'plateletAdequacy',  label: 'Platelet Adequacy',  unit: '', normalLow: null, normalHigh: null },
      { key: 'parasites',         label: 'Parasites',          unit: '', normalLow: null, normalHigh: null },
      { key: 'impression',        label: 'Impression',         unit: '', normalLow: null, normalHigh: null },
    ],
  },

  // ──────────────────────────────────────────────────────────────────
  // BIOCHEMISTRY (covers both 'Biochemistry' and 'Bio Chemistry')
  // ──────────────────────────────────────────────────────────────────

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
    aliases: ['LFT', 'Liver Function', 'Hepatic Function Panel'],
    fields: [
      { key: 'totalBilirubin',    label: 'Total Bilirubin',       unit: 'mg/dL',  normalLow: 0.1, normalHigh: 1.2 },
      { key: 'directBilirubin',   label: 'Direct Bilirubin',      unit: 'mg/dL',  normalLow: 0,   normalHigh: 0.3 },
      { key: 'indirectBilirubin', label: 'Indirect Bilirubin',    unit: 'mg/dL',  normalLow: 0,   normalHigh: 0.9 },
      { key: 'sgpt',              label: 'SGPT (ALT)',            unit: 'U/L',    normalLow: 0,   normalHigh: 45 },
      { key: 'sgot',              label: 'SGOT (AST)',            unit: 'U/L',    normalLow: 0,   normalHigh: 40 },
      { key: 'alkPhos',           label: 'Alkaline Phosphatase',  unit: 'U/L',    normalLow: 40,  normalHigh: 130 },
      { key: 'ggt',               label: 'GGT',                   unit: 'U/L',    normalLow: 8,   normalHigh: 61 },
      { key: 'totalProtein',      label: 'Total Protein',         unit: 'g/dL',   normalLow: 6.4, normalHigh: 8.3 },
      { key: 'albumin',           label: 'Albumin',               unit: 'g/dL',   normalLow: 3.5, normalHigh: 5.0 },
      { key: 'globulin',          label: 'Globulin',              unit: 'g/dL',   normalLow: 2.0, normalHigh: 3.5 },
      { key: 'agRatio',           label: 'A/G Ratio',             unit: '',       normalLow: 1.0, normalHigh: 2.5 },
    ],
  },

  'Kidney Function Test (KFT)': {
    category: 'Bio Chemistry',
    aliases: ['KFT', 'Renal Function Test', 'RFT'],
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
    aliases: ['TFT', 'Thyroid Profile'],
    fields: [
      { key: 'tsh',     label: 'TSH',           unit: 'µIU/mL',  normalLow: 0.4, normalHigh: 4.0 },
      { key: 't3',      label: 'Total T3',      unit: 'ng/dL',   normalLow: 80,  normalHigh: 200 },
      { key: 't4',      label: 'Total T4',      unit: 'µg/dL',   normalLow: 5,   normalHigh: 12 },
      { key: 'freeT3',  label: 'Free T3',       unit: 'pg/mL',   normalLow: 2.0, normalHigh: 4.4 },
      { key: 'freeT4',  label: 'Free T4',       unit: 'ng/dL',   normalLow: 0.8, normalHigh: 1.8 },
    ],
  },

  'TSH (Thyroid Stimulating Hormone)': {
    category: 'Bio Chemistry',
    aliases: ['TSH', 'TSH (only)', 'Thyroid Stimulating Hormone'],
    fields: [
      { key: 'tsh', label: 'TSH', unit: 'µIU/mL', normalLow: 0.4, normalHigh: 4.0 },
    ],
  },

  'Free T3 / Free T4': {
    category: 'Endocrine',
    aliases: ['Free T3', 'Free T4', 'FT3 FT4'],
    fields: [
      { key: 'freeT3',  label: 'Free T3',       unit: 'pg/mL',   normalLow: 2.0, normalHigh: 4.4 },
      { key: 'freeT4',  label: 'Free T4',       unit: 'ng/dL',   normalLow: 0.8, normalHigh: 1.8 },
    ],
  },

  'HbA1c (Glycated Haemoglobin)': {
    category: 'Bio Chemistry',
    aliases: ['HbA1c', 'Glycated Haemoglobin', 'Glycosylated Haemoglobin', 'A1c'],
    fields: [
      { key: 'hba1c', label: 'HbA1c',                  unit: '%',     normalLow: 0,   normalHigh: 5.6 },
      { key: 'eag',   label: 'Estimated Avg Glucose',  unit: 'mg/dL', normalLow: 0,   normalHigh: 117 },
    ],
  },

  'Random Blood Sugar (RBS)': {
    category: 'Bio Chemistry',
    aliases: ['RBS', 'Random Blood Sugar', 'Random Glucose'],
    fields: [
      { key: 'rbs', label: 'Random Blood Sugar', unit: 'mg/dL', normalLow: 70, normalHigh: 140 },
    ],
  },

  'Fasting Blood Sugar (FBS)': {
    category: 'Bio Chemistry',
    aliases: ['FBS', 'Fasting Blood Sugar', 'Fasting Glucose',
              'Blood Sugar Fasting (BSF)', 'Blood Sugar Fasting', 'BSF'],
    fields: [
      { key: 'fbs', label: 'Fasting Blood Sugar', unit: 'mg/dL', normalLow: 70, normalHigh: 100 },
    ],
  },

  'Post Prandial Blood Sugar (PPBS)': {
    category: 'Bio Chemistry',
    aliases: ['PPBS', 'PP Blood Sugar', '2 Hour PP', 'Post Prandial Glucose',
              'Blood Sugar Post Prandial (BSPP)', 'Blood Sugar Post Prandial', 'BSPP'],
    fields: [
      { key: 'ppbs', label: 'Post Prandial Blood Sugar', unit: 'mg/dL', normalLow: 70, normalHigh: 140 },
    ],
  },

  'Glucose Tolerance Test (GTT)': {
    category: 'Bio Chemistry',
    aliases: ['GTT', 'OGTT', 'Oral Glucose Tolerance Test'],
    fields: [
      { key: 'fastingGlucose',  label: 'Fasting Glucose (0 hr)',   unit: 'mg/dL', normalLow: 70,  normalHigh: 100 },
      { key: 'oneHourGlucose',  label: '1 Hour Glucose',           unit: 'mg/dL', normalLow: 70,  normalHigh: 180 },
      { key: 'twoHourGlucose',  label: '2 Hour Glucose',           unit: 'mg/dL', normalLow: 70,  normalHigh: 140 },
    ],
  },

  'Serum Electrolytes (Na, K, Cl)': {
    category: 'Bio Chemistry',
    aliases: ['Serum Electrolytes', 'Electrolytes', 'Na K Cl', 'NaKCl'],
    fields: [
      { key: 'sodium',    label: 'Sodium (Na+)',     unit: 'mEq/L', normalLow: 136, normalHigh: 145 },
      { key: 'potassium', label: 'Potassium (K+)',   unit: 'mEq/L', normalLow: 3.5, normalHigh: 5.1 },
      { key: 'chloride',  label: 'Chloride (Cl-)',   unit: 'mEq/L', normalLow: 98,  normalHigh: 107 },
    ],
  },

  'Serum Creatinine': {
    category: 'Bio Chemistry',
    aliases: ['Creatinine'],
    fields: [
      { key: 'serumCreatinine', label: 'Serum Creatinine', unit: 'mg/dL', normalLow: 0.6, normalHigh: 1.3 },
    ],
  },

  'Serum Uric Acid': {
    category: 'Bio Chemistry',
    aliases: ['Uric Acid'],
    fields: [
      { key: 'uricAcid', label: 'Uric Acid', unit: 'mg/dL', normalLow: 3.5, normalHigh: 7.2 },
    ],
  },

  'Serum Ferritin': {
    category: 'Bio Chemistry',
    aliases: ['Ferritin'],
    fields: [
      { key: 'ferritin', label: 'Ferritin', unit: 'ng/mL', normalLow: 30, normalHigh: 400 },
    ],
  },

  'Iron Studies': {
    category: 'Bio Chemistry',
    aliases: ['Iron Profile'],
    fields: [
      { key: 'serumIron',     label: 'Serum Iron',           unit: 'μg/dL', normalLow: 65,  normalHigh: 175 },
      { key: 'tibc',          label: 'TIBC',                 unit: 'μg/dL', normalLow: 250, normalHigh: 450 },
      { key: 'transferrin',   label: 'Transferrin Saturation', unit: '%',   normalLow: 20,  normalHigh: 50 },
      { key: 'ferritin',      label: 'Ferritin',             unit: 'ng/mL', normalLow: 30,  normalHigh: 400 },
    ],
  },

  'Vitamin B12 Level': {
    category: 'Bio Chemistry',
    aliases: ['Vitamin B12', 'B12', 'Cobalamin'],
    fields: [
      { key: 'vitaminB12', label: 'Vitamin B12', unit: 'pg/mL', normalLow: 200, normalHigh: 900 },
    ],
  },

  'Vitamin D3 Level': {
    category: 'Bio Chemistry',
    aliases: ['Vitamin D3', 'Vitamin D', 'Vitamin D (25-OH)', '25 OH Vitamin D'],
    fields: [
      { key: 'vitaminD', label: '25-OH Vitamin D', unit: 'ng/mL', normalLow: 30, normalHigh: 100 },
    ],
  },

  'CRP (C-Reactive Protein)': {
    category: 'Bio Chemistry',
    aliases: ['CRP', 'C-Reactive Protein'],
    fields: [
      { key: 'crp', label: 'CRP', unit: 'mg/L', normalLow: 0, normalHigh: 5 },
    ],
  },

  'hs-CRP (high-sensitivity)': {
    category: 'Bio Chemistry',
    aliases: ['hs-CRP', 'hsCRP', 'High Sensitivity CRP'],
    fields: [
      { key: 'hsCrp', label: 'hs-CRP', unit: 'mg/L', normalLow: 0, normalHigh: 1 },
    ],
  },

  'Procalcitonin': {
    category: 'Bio Chemistry',
    aliases: ['PCT'],
    fields: [
      { key: 'procalcitonin', label: 'Procalcitonin', unit: 'ng/mL', normalLow: 0, normalHigh: 0.5 },
    ],
  },

  'Calcium / Bone Profile': {
    category: 'Bio Chemistry',
    aliases: ['Bone Profile', 'Calcium Profile'],
    fields: [
      { key: 'calcium',     label: 'Calcium (Total)',      unit: 'mg/dL', normalLow: 8.5, normalHigh: 10.5 },
      { key: 'ionizedCa',   label: 'Ionized Calcium',      unit: 'mg/dL', normalLow: 4.5, normalHigh: 5.5 },
      { key: 'phosphorus',  label: 'Phosphorus',           unit: 'mg/dL', normalLow: 2.5, normalHigh: 4.5 },
      { key: 'alkPhos',     label: 'Alkaline Phosphatase', unit: 'U/L',   normalLow: 40,  normalHigh: 130 },
      { key: 'vitaminD',    label: '25-OH Vitamin D',      unit: 'ng/mL', normalLow: 30,  normalHigh: 100 },
    ],
  },

  'Insulin & C-Peptide Profile': {
    category: 'Bio Chemistry',
    aliases: ['Insulin C-Peptide', 'Insulin Profile'],
    fields: [
      { key: 'fastingInsulin',  label: 'Fasting Insulin',  unit: 'µIU/mL', normalLow: 2.6, normalHigh: 24.9 },
      { key: 'fastingCPeptide', label: 'Fasting C-Peptide', unit: 'ng/mL', normalLow: 1.1, normalHigh: 4.4 },
      { key: 'fastingGlucose',  label: 'Fasting Glucose',  unit: 'mg/dL', normalLow: 70,  normalHigh: 100 },
    ],
  },

  'Arterial Blood Gas (ABG)': {
    category: 'Bio Chemistry',
    aliases: ['ABG', 'Blood Gas'],
    fields: [
      { key: 'ph',         label: 'pH',                  unit: '',      normalLow: 7.35, normalHigh: 7.45 },
      { key: 'pco2',       label: 'pCO2',                unit: 'mmHg',  normalLow: 35,   normalHigh: 45 },
      { key: 'po2',        label: 'pO2',                 unit: 'mmHg',  normalLow: 80,   normalHigh: 100 },
      { key: 'hco3',       label: 'HCO3-',               unit: 'mEq/L', normalLow: 22,   normalHigh: 26 },
      { key: 'baseExcess', label: 'Base Excess',         unit: 'mEq/L', normalLow: -2,   normalHigh: 2 },
      { key: 'so2',        label: 'O2 Saturation (SO2)', unit: '%',     normalLow: 95,   normalHigh: 100 },
      { key: 'lactate',    label: 'Lactate',             unit: 'mmol/L', normalLow: 0.5, normalHigh: 2.2 },
    ],
  },

  'CPK / CK Total': {
    category: 'Bio Chemistry',
    aliases: ['CPK', 'CK', 'Creatine Kinase'],
    fields: [
      { key: 'cpk', label: 'CPK / CK Total', unit: 'U/L', normalLow: 30, normalHigh: 200 },
    ],
  },

  'LDH (Lactate Dehydrogenase)': {
    category: 'Bio Chemistry',
    aliases: ['LDH', 'Lactate Dehydrogenase'],
    fields: [
      { key: 'ldh', label: 'LDH', unit: 'U/L', normalLow: 140, normalHigh: 280 },
    ],
  },

  'Magnesium': {
    category: 'Bio Chemistry',
    aliases: ['Mg', 'Serum Magnesium'],
    fields: [
      { key: 'magnesium', label: 'Magnesium', unit: 'mg/dL', normalLow: 1.7, normalHigh: 2.4 },
    ],
  },

  'Homocysteine': {
    category: 'Bio Chemistry',
    fields: [
      { key: 'homocysteine', label: 'Homocysteine', unit: 'µmol/L', normalLow: 5, normalHigh: 15 },
    ],
  },

  'Folate / Folic Acid': {
    category: 'Bio Chemistry',
    aliases: ['Folate', 'Folic Acid'],
    fields: [
      { key: 'folate', label: 'Folate (Folic Acid)', unit: 'ng/mL', normalLow: 3, normalHigh: 17 },
    ],
  },

  'Serum Albumin': {
    category: 'Bio Chemistry',
    aliases: ['Albumin'],
    fields: [
      { key: 'albumin', label: 'Albumin', unit: 'g/dL', normalLow: 3.5, normalHigh: 5.0 },
    ],
  },

  'Total Protein': {
    category: 'Bio Chemistry',
    aliases: ['Serum Total Protein'],
    fields: [
      { key: 'totalProtein', label: 'Total Protein', unit: 'g/dL', normalLow: 6.4, normalHigh: 8.3 },
    ],
  },

  'Serum Amylase': {
    category: 'Bio Chemistry',
    aliases: ['Amylase'],
    fields: [
      { key: 'amylase', label: 'Amylase', unit: 'U/L', normalLow: 25, normalHigh: 125 },
    ],
  },

  'Serum Lipase': {
    category: 'Bio Chemistry',
    aliases: ['Lipase'],
    fields: [
      { key: 'lipase', label: 'Lipase', unit: 'U/L', normalLow: 13, normalHigh: 60 },
    ],
  },

  // ──────────────────────────────────────────────────────────────────
  // CARDIAC MARKERS
  // ──────────────────────────────────────────────────────────────────

  'Cardiac Markers (Troponin / CK-MB)': {
    category: 'Cardiac',
    aliases: ['Cardiac Markers', 'Troponin', 'Trop', 'CK-MB', 'CKMB'],
    fields: [
      { key: 'troponinI', label: 'Troponin I',  unit: 'ng/mL', normalLow: 0,  normalHigh: 0.04 },
      { key: 'ckMB',      label: 'CK-MB',       unit: 'ng/mL', normalLow: 0,  normalHigh: 6.3 },
      { key: 'totalCK',   label: 'Total CK',    unit: 'U/L',   normalLow: 30, normalHigh: 200 },
    ],
  },

  'BNP / NT-proBNP': {
    category: 'Cardiac',
    aliases: ['BNP', 'NT-proBNP', 'NT proBNP'],
    fields: [
      { key: 'bnp',        label: 'BNP',        unit: 'pg/mL', normalLow: 0, normalHigh: 100 },
      { key: 'ntProBNP',   label: 'NT-proBNP',  unit: 'pg/mL', normalLow: 0, normalHigh: 125 },
    ],
  },

  // ──────────────────────────────────────────────────────────────────
  // ENDOCRINE
  // ──────────────────────────────────────────────────────────────────

  'Cortisol (Serum)': {
    category: 'Endocrine',
    aliases: ['Cortisol'],
    fields: [
      { key: 'cortisolMorning',  label: 'Morning Cortisol (8 AM)',   unit: 'µg/dL', normalLow: 7,  normalHigh: 25 },
      { key: 'cortisolEvening',  label: 'Evening Cortisol (4 PM)',   unit: 'µg/dL', normalLow: 2,  normalHigh: 14 },
    ],
  },

  'Prolactin': {
    category: 'Endocrine',
    fields: [
      { key: 'prolactin', label: 'Prolactin', unit: 'ng/mL', normalLow: 4, normalHigh: 25 },
    ],
  },

  'Total Testosterone': {
    category: 'Endocrine',
    aliases: ['Testosterone'],
    fields: [
      { key: 'totalTestosterone', label: 'Total Testosterone', unit: 'ng/dL', normalLow: 280, normalHigh: 1100 },
    ],
  },

  'Free Testosterone': {
    category: 'Endocrine',
    fields: [
      { key: 'freeTestosterone', label: 'Free Testosterone', unit: 'pg/mL', normalLow: 8.7, normalHigh: 25.1 },
    ],
  },

  'Estradiol (E2)': {
    category: 'Endocrine',
    aliases: ['Estradiol', 'E2'],
    fields: [
      { key: 'estradiol', label: 'Estradiol (E2)', unit: 'pg/mL', normalLow: null, normalHigh: null },
    ],
  },

  'Serum Progesterone': {
    category: 'Endocrine',
    aliases: ['Progesterone'],
    fields: [
      { key: 'progesterone', label: 'Progesterone', unit: 'ng/mL', normalLow: null, normalHigh: null },
    ],
  },

  'Anti-Müllerian Hormone (AMH)': {
    category: 'Endocrine',
    aliases: ['AMH', 'Anti-Mullerian Hormone'],
    fields: [
      { key: 'amh', label: 'AMH', unit: 'ng/mL', normalLow: 1.0, normalHigh: 4.0 },
    ],
  },

  'Anti-TPO Antibody': {
    category: 'Endocrine',
    aliases: ['Anti TPO', 'TPO Antibody', 'Anti-Thyroid Peroxidase'],
    fields: [
      { key: 'antiTPO', label: 'Anti-TPO', unit: 'IU/mL', normalLow: 0, normalHigh: 34 },
    ],
  },

  'Parathyroid Hormone (PTH)': {
    category: 'Endocrine',
    aliases: ['PTH', 'Parathormone'],
    fields: [
      { key: 'pth', label: 'PTH', unit: 'pg/mL', normalLow: 15, normalHigh: 65 },
    ],
  },

  'Growth Hormone (GH)': {
    category: 'Endocrine',
    aliases: ['GH', 'Growth Hormone'],
    fields: [
      { key: 'gh', label: 'Growth Hormone', unit: 'ng/mL', normalLow: 0, normalHigh: 5 },
    ],
  },

  'IGF-1 (Somatomedin C)': {
    category: 'Endocrine',
    aliases: ['IGF-1', 'IGF1', 'Somatomedin C'],
    fields: [
      { key: 'igf1', label: 'IGF-1', unit: 'ng/mL', normalLow: 88, normalHigh: 246 },
    ],
  },

  'DHEA-S': {
    category: 'Endocrine',
    aliases: ['DHEAS', 'Dehydroepiandrosterone Sulfate'],
    fields: [
      { key: 'dheaS', label: 'DHEA-S', unit: 'µg/dL', normalLow: 35, normalHigh: 430 },
    ],
  },

  'ACTH (Adrenocorticotropic Hormone)': {
    category: 'Endocrine',
    aliases: ['ACTH'],
    fields: [
      { key: 'acth', label: 'ACTH (8 AM)', unit: 'pg/mL', normalLow: 7.2, normalHigh: 63 },
    ],
  },

  '17-OH Progesterone': {
    category: 'Endocrine',
    aliases: ['17 OH Progesterone', '17-OHP'],
    fields: [
      { key: 'oh17Progesterone', label: '17-OH Progesterone', unit: 'ng/mL', normalLow: null, normalHigh: 2 },
    ],
  },

  // ──────────────────────────────────────────────────────────────────
  // ONCOLOGY (TUMOR MARKERS)
  // ──────────────────────────────────────────────────────────────────

  'AFP (Alpha-Fetoprotein)': {
    category: 'Oncology',
    aliases: ['AFP', 'Alpha-Fetoprotein', 'Alpha Fetoprotein'],
    fields: [
      { key: 'afp', label: 'AFP', unit: 'ng/mL', normalLow: 0, normalHigh: 10 },
    ],
  },

  'CA-125': {
    category: 'Oncology',
    aliases: ['CA125', 'Cancer Antigen 125'],
    fields: [
      { key: 'ca125', label: 'CA-125', unit: 'U/mL', normalLow: 0, normalHigh: 35 },
    ],
  },

  'CA 15-3': {
    category: 'Oncology',
    aliases: ['CA15-3', 'CA153'],
    fields: [
      { key: 'ca153', label: 'CA 15-3', unit: 'U/mL', normalLow: 0, normalHigh: 30 },
    ],
  },

  'CA 19-9': {
    category: 'Oncology',
    aliases: ['CA19-9', 'CA199'],
    fields: [
      { key: 'ca199', label: 'CA 19-9', unit: 'U/mL', normalLow: 0, normalHigh: 37 },
    ],
  },

  'CEA': {
    category: 'Oncology',
    aliases: ['Carcinoembryonic Antigen'],
    fields: [
      { key: 'cea', label: 'CEA', unit: 'ng/mL', normalLow: 0, normalHigh: 5 },
    ],
  },

  'PSA (Prostate Specific Antigen)': {
    category: 'Oncology',
    aliases: ['PSA', 'Prostate Specific Antigen', 'Total PSA'],
    fields: [
      { key: 'totalPSA', label: 'Total PSA',  unit: 'ng/mL', normalLow: 0, normalHigh: 4 },
      { key: 'freePSA',  label: 'Free PSA',   unit: 'ng/mL', normalLow: null, normalHigh: null },
    ],
  },

  'Beta-2 Microglobulin': {
    category: 'Oncology',
    aliases: ['Beta 2 Microglobulin', 'B2M'],
    fields: [
      { key: 'b2m', label: 'Beta-2 Microglobulin', unit: 'mg/L', normalLow: 0.8, normalHigh: 2.4 },
    ],
  },

  'NSE (Neuron-Specific Enolase)': {
    category: 'Oncology',
    aliases: ['NSE', 'Neuron Specific Enolase'],
    fields: [
      { key: 'nse', label: 'NSE', unit: 'ng/mL', normalLow: 0, normalHigh: 16.3 },
    ],
  },

  // ──────────────────────────────────────────────────────────────────
  // SEROLOGY (qualitative - single positive/negative result, but useful
  // to keep as structured field for trending of titers)
  // ──────────────────────────────────────────────────────────────────

  'ANA (Antinuclear Antibody)': {
    category: 'Serology',
    aliases: ['ANA', 'Antinuclear Antibody'],
    fields: [
      { key: 'anaResult',  label: 'ANA Result',  unit: '', normalLow: null, normalHigh: null },
      { key: 'titer',      label: 'Titer',       unit: '', normalLow: null, normalHigh: null },
      { key: 'pattern',    label: 'Pattern',     unit: '', normalLow: null, normalHigh: null },
    ],
  },

  'RA Factor (Rheumatoid Arthritis)': {
    category: 'Serology',
    aliases: ['RA Factor', 'Rheumatoid Factor', 'RF'],
    fields: [
      { key: 'raFactor', label: 'RA Factor', unit: 'IU/mL', normalLow: 0, normalHigh: 14 },
    ],
  },

  'ASO Titre': {
    category: 'Serology',
    aliases: ['ASO', 'Anti-Streptolysin O', 'ASLO'],
    fields: [
      { key: 'aso', label: 'ASO', unit: 'IU/mL', normalLow: 0, normalHigh: 200 },
    ],
  },

  'Widal Test': {
    category: 'Serology',
    aliases: ['Widal'],
    fields: [
      { key: 'sTyphiO',         label: 'S. Typhi O',        unit: '', normalLow: null, normalHigh: null },
      { key: 'sTyphiH',         label: 'S. Typhi H',        unit: '', normalLow: null, normalHigh: null },
      { key: 'sParatyphiAH',    label: 'S. Paratyphi A H',  unit: '', normalLow: null, normalHigh: null },
      { key: 'sParatyphiBH',    label: 'S. Paratyphi B H',  unit: '', normalLow: null, normalHigh: null },
    ],
  },

  'Dengue NS1 Antigen': {
    category: 'Serology',
    aliases: ['Dengue NS1', 'NS1 Antigen'],
    fields: [
      { key: 'ns1', label: 'NS1 Antigen', unit: '', normalLow: null, normalHigh: null },
    ],
  },

  'Dengue IgM / IgG': {
    category: 'Serology',
    aliases: ['Dengue IgM IgG', 'Dengue Serology'],
    fields: [
      { key: 'dengueIgM', label: 'Dengue IgM', unit: '', normalLow: null, normalHigh: null },
      { key: 'dengueIgG', label: 'Dengue IgG', unit: '', normalLow: null, normalHigh: null },
    ],
  },

  'Malaria Antigen Test (MAT)': {
    category: 'Serology',
    aliases: ['Malaria Antigen', 'MAT', 'Malaria Antigen Test', 'MP Antigen'],
    fields: [
      { key: 'pFalciparum', label: 'P. falciparum', unit: '', normalLow: null, normalHigh: null },
      { key: 'pVivax',      label: 'P. vivax',      unit: '', normalLow: null, normalHigh: null },
    ],
  },

  'Typhoid IgM': {
    category: 'Serology',
    fields: [
      { key: 'typhoidIgM', label: 'Typhoid IgM', unit: '', normalLow: null, normalHigh: null },
    ],
  },

  'Chikungunya IgM': {
    category: 'Serology',
    fields: [
      { key: 'chikIgM', label: 'Chikungunya IgM', unit: '', normalLow: null, normalHigh: null },
    ],
  },

  'Chikungunya IgG': {
    category: 'Serology',
    fields: [
      { key: 'chikIgG', label: 'Chikungunya IgG', unit: '', normalLow: null, normalHigh: null },
    ],
  },

  'Leptospira IgM': {
    category: 'Serology',
    fields: [
      { key: 'leptoIgM', label: 'Leptospira IgM', unit: '', normalLow: null, normalHigh: null },
    ],
  },

  'HIV (1 & 2) ELISA': {
    category: 'Serology',
    aliases: ['HIV ELISA', 'HIV 1 2'],
    fields: [
      { key: 'hiv1', label: 'HIV 1', unit: '', normalLow: null, normalHigh: null },
      { key: 'hiv2', label: 'HIV 2', unit: '', normalLow: null, normalHigh: null },
    ],
  },

  'HBsAg (Hepatitis B)': {
    category: 'Serology',
    aliases: ['HBsAg', 'Hep B Surface Antigen'],
    fields: [
      { key: 'hbsAg', label: 'HBsAg', unit: '', normalLow: null, normalHigh: null },
    ],
  },

  'Anti-HCV (Hepatitis C)': {
    category: 'Serology',
    aliases: ['Anti HCV', 'HCV'],
    fields: [
      { key: 'antiHCV', label: 'Anti-HCV', unit: '', normalLow: null, normalHigh: null },
    ],
  },

  'VDRL / RPR': {
    category: 'Serology',
    aliases: ['VDRL', 'RPR', 'Syphilis Test'],
    fields: [
      { key: 'vdrl',  label: 'VDRL', unit: '', normalLow: null, normalHigh: null },
    ],
  },

  'COVID-19 Antigen Test': {
    category: 'Serology',
    aliases: ['COVID-19 Antigen', 'COVID Antigen', 'RAT'],
    fields: [
      { key: 'covid19Antigen', label: 'COVID-19 Antigen', unit: '', normalLow: null, normalHigh: null },
    ],
  },

  'COVID-19 RT-PCR / Antigen': {
    category: 'Serology',
    aliases: ['COVID-19 RT-PCR', 'COVID RT-PCR', 'RT-PCR'],
    fields: [
      { key: 'covidPCR',     label: 'RT-PCR Result',   unit: '', normalLow: null, normalHigh: null },
      { key: 'ctValue',      label: 'Ct Value',        unit: '', normalLow: null, normalHigh: null },
    ],
  },

  // ──────────────────────────────────────────────────────────────────
  // ALLERGY & IMMUNOLOGY
  // ──────────────────────────────────────────────────────────────────

  'Anti-CCP Antibody': {
    category: 'Allergy & Immunology',
    aliases: ['Anti CCP', 'CCP'],
    fields: [
      { key: 'antiCCP', label: 'Anti-CCP', unit: 'U/mL', normalLow: 0, normalHigh: 20 },
    ],
  },

  'Anti-dsDNA Antibody': {
    category: 'Allergy & Immunology',
    aliases: ['Anti dsDNA', 'dsDNA'],
    fields: [
      { key: 'antiDsDNA', label: 'Anti-dsDNA', unit: 'IU/mL', normalLow: 0, normalHigh: 30 },
    ],
  },

  'C3 Complement': {
    category: 'Allergy & Immunology',
    aliases: ['C3'],
    fields: [
      { key: 'c3', label: 'C3', unit: 'mg/dL', normalLow: 90, normalHigh: 180 },
    ],
  },

  'C4 Complement': {
    category: 'Allergy & Immunology',
    aliases: ['C4'],
    fields: [
      { key: 'c4', label: 'C4', unit: 'mg/dL', normalLow: 10, normalHigh: 40 },
    ],
  },

  'Total IgE': {
    category: 'Allergy & Immunology',
    aliases: ['IgE Total'],
    fields: [
      { key: 'totalIgE', label: 'Total IgE', unit: 'IU/mL', normalLow: 0, normalHigh: 100 },
    ],
  },

  'Immunoglobulins (IgA / IgG / IgM)': {
    category: 'Allergy & Immunology',
    aliases: ['Immunoglobulins', 'Ig Profile'],
    fields: [
      { key: 'igA', label: 'IgA', unit: 'mg/dL', normalLow: 70,  normalHigh: 400 },
      { key: 'igG', label: 'IgG', unit: 'mg/dL', normalLow: 700, normalHigh: 1600 },
      { key: 'igM', label: 'IgM', unit: 'mg/dL', normalLow: 40,  normalHigh: 230 },
    ],
  },

  'ANCA (c-ANCA / p-ANCA)': {
    category: 'Allergy & Immunology',
    aliases: ['ANCA'],
    fields: [
      { key: 'cANCA', label: 'c-ANCA', unit: '', normalLow: null, normalHigh: null },
      { key: 'pANCA', label: 'p-ANCA', unit: '', normalLow: null, normalHigh: null },
    ],
  },

  // ──────────────────────────────────────────────────────────────────
  // URINE
  // ──────────────────────────────────────────────────────────────────

  'Urine Routine': {
    category: 'Urine',
    aliases: ['Urine Routine & Microscopy', 'Urine R/M', 'Urine Examination'],
    fields: [
      { key: 'color',           label: 'Colour',           unit: '',     normalLow: null, normalHigh: null },
      { key: 'appearance',      label: 'Appearance',       unit: '',     normalLow: null, normalHigh: null },
      { key: 'specificGravity', label: 'Specific Gravity', unit: '',     normalLow: 1.005, normalHigh: 1.030 },
      { key: 'ph',              label: 'pH',               unit: '',     normalLow: 5.0, normalHigh: 7.5 },
      { key: 'protein',         label: 'Protein',          unit: '',     normalLow: null, normalHigh: null },
      { key: 'glucose',         label: 'Glucose',          unit: '',     normalLow: null, normalHigh: null },
      { key: 'ketones',         label: 'Ketones',          unit: '',     normalLow: null, normalHigh: null },
      { key: 'bilirubin',       label: 'Bilirubin',        unit: '',     normalLow: null, normalHigh: null },
      { key: 'urobilinogen',    label: 'Urobilinogen',     unit: '',     normalLow: null, normalHigh: null },
      { key: 'blood',           label: 'Blood',            unit: '',     normalLow: null, normalHigh: null },
      { key: 'nitrites',        label: 'Nitrites',         unit: '',     normalLow: null, normalHigh: null },
      { key: 'leukoEsterase',   label: 'Leukocyte Esterase', unit: '',   normalLow: null, normalHigh: null },
      { key: 'pusCells',        label: 'Pus Cells',        unit: '/HPF', normalLow: 0,   normalHigh: 5 },
      { key: 'rbcCells',        label: 'RBC',              unit: '/HPF', normalLow: 0,   normalHigh: 2 },
      { key: 'epithelialCells', label: 'Epithelial Cells', unit: '/HPF', normalLow: 0,   normalHigh: 5 },
      { key: 'casts',           label: 'Casts',            unit: '',     normalLow: null, normalHigh: null },
      { key: 'crystals',        label: 'Crystals',         unit: '',     normalLow: null, normalHigh: null },
    ],
  },

  'Urine Microalbumin': {
    category: 'Urine',
    fields: [
      { key: 'microalbumin', label: 'Microalbumin', unit: 'mg/L', normalLow: 0, normalHigh: 30 },
    ],
  },

  '24-hour Urine Protein': {
    category: 'Urine',
    aliases: ['24 Hour Urine Protein', '24 hr Urine Protein'],
    fields: [
      { key: 'totalVolume',    label: 'Total Volume',     unit: 'mL',     normalLow: 800, normalHigh: 2000 },
      { key: 'urineProtein24', label: '24-hr Protein',    unit: 'mg/24h', normalLow: 0,   normalHigh: 150 },
    ],
  },

  'Urine Albumin/Creatinine Ratio (UACR)': {
    category: 'Urine',
    aliases: ['UACR', 'ACR'],
    fields: [
      { key: 'uacr', label: 'Albumin/Creatinine Ratio', unit: 'mg/g', normalLow: 0, normalHigh: 30 },
    ],
  },

  // ──────────────────────────────────────────────────────────────────
  // VITAMINS (single field each)
  // ──────────────────────────────────────────────────────────────────

  'Vitamin A (Retinol)': {
    category: 'Vitamins',
    aliases: ['Vitamin A', 'Retinol'],
    fields: [
      { key: 'vitaminA', label: 'Vitamin A (Retinol)', unit: 'µg/dL', normalLow: 30, normalHigh: 80 },
    ],
  },

  'Vitamin B1 (Thiamine)': {
    category: 'Vitamins',
    aliases: ['Vitamin B1', 'Thiamine'],
    fields: [
      { key: 'vitaminB1', label: 'Vitamin B1 (Thiamine)', unit: 'nmol/L', normalLow: 70, normalHigh: 180 },
    ],
  },

  'Vitamin B6 (Pyridoxine)': {
    category: 'Vitamins',
    aliases: ['Vitamin B6', 'Pyridoxine'],
    fields: [
      { key: 'vitaminB6', label: 'Vitamin B6 (Pyridoxine)', unit: 'ng/mL', normalLow: 5, normalHigh: 50 },
    ],
  },

  'Vitamin C (Ascorbic Acid)': {
    category: 'Vitamins',
    aliases: ['Vitamin C', 'Ascorbic Acid'],
    fields: [
      { key: 'vitaminC', label: 'Vitamin C', unit: 'mg/dL', normalLow: 0.4, normalHigh: 2.0 },
    ],
  },

  'Vitamin E (Tocopherol)': {
    category: 'Vitamins',
    aliases: ['Vitamin E', 'Tocopherol'],
    fields: [
      { key: 'vitaminE', label: 'Vitamin E (Tocopherol)', unit: 'mg/L', normalLow: 5.5, normalHigh: 17 },
    ],
  },

  'Vitamin K (Phylloquinone)': {
    category: 'Vitamins',
    aliases: ['Vitamin K', 'Phylloquinone'],
    fields: [
      { key: 'vitaminK', label: 'Vitamin K', unit: 'ng/mL', normalLow: 0.2, normalHigh: 3.2 },
    ],
  },

  // ──────────────────────────────────────────────────────────────────
  // MICROBIOLOGY (cultures - keep simple structured fields for organism + sensitivity)
  // ──────────────────────────────────────────────────────────────────

  'Blood Culture & Sensitivity': {
    category: 'Microbiology',
    aliases: ['Blood Culture', 'BC&S'],
    fields: [
      { key: 'organism',     label: 'Organism Isolated', unit: '', normalLow: null, normalHigh: null },
      { key: 'sensitivity',  label: 'Sensitive To',      unit: '', normalLow: null, normalHigh: null },
      { key: 'resistant',    label: 'Resistant To',      unit: '', normalLow: null, normalHigh: null },
    ],
  },

  'Urine Culture & Sensitivity': {
    category: 'Microbiology',
    aliases: ['Urine Culture', 'UC&S'],
    fields: [
      { key: 'colonyCount',  label: 'Colony Count',      unit: 'CFU/mL', normalLow: null, normalHigh: null },
      { key: 'organism',     label: 'Organism Isolated', unit: '', normalLow: null, normalHigh: null },
      { key: 'sensitivity',  label: 'Sensitive To',      unit: '', normalLow: null, normalHigh: null },
      { key: 'resistant',    label: 'Resistant To',      unit: '', normalLow: null, normalHigh: null },
    ],
  },

  'Throat Swab Culture': {
    category: 'Microbiology',
    aliases: ['Throat Swab', 'Throat Culture'],
    fields: [
      { key: 'organism',    label: 'Organism Isolated', unit: '', normalLow: null, normalHigh: null },
      { key: 'sensitivity', label: 'Sensitive To',      unit: '', normalLow: null, normalHigh: null },
    ],
  },

  'HVS / Vaginal Swab Culture': {
    category: 'Microbiology',
    aliases: ['HVS', 'Vaginal Swab'],
    fields: [
      { key: 'organism',    label: 'Organism Isolated', unit: '', normalLow: null, normalHigh: null },
      { key: 'sensitivity', label: 'Sensitive To',      unit: '', normalLow: null, normalHigh: null },
    ],
  },

  'Sputum AFB / GeneXpert (TB)': {
    category: 'Microbiology',
    aliases: ['Sputum AFB', 'AFB', 'GeneXpert', 'CBNAAT', 'Sputum AFB (TB Test)'],
    fields: [
      { key: 'afbResult',         label: 'AFB Smear',        unit: '', normalLow: null, normalHigh: null },
      { key: 'geneXpert',         label: 'GeneXpert (CBNAAT)', unit: '', normalLow: null, normalHigh: null },
      { key: 'rifResistance',     label: 'Rifampicin Resistance', unit: '', normalLow: null, normalHigh: null },
    ],
  },

  'Mantoux / Tuberculin Skin Test': {
    category: 'Microbiology',
    aliases: ['Mantoux', 'TST', 'Tuberculin Skin Test'],
    fields: [
      { key: 'inducationMM',  label: 'Induration (mm)', unit: 'mm', normalLow: 0, normalHigh: 10 },
      { key: 'interpretation', label: 'Interpretation', unit: '',   normalLow: null, normalHigh: null },
    ],
  },

  'H. pylori Stool Antigen': {
    category: 'GI / Endoscopy',
    aliases: ['H pylori Stool', 'H. pylori Antigen'],
    fields: [
      { key: 'hPyloriResult', label: 'H. pylori Result', unit: '', normalLow: null, normalHigh: null },
    ],
  },

  'H. pylori Urea Breath Test': {
    category: 'GI / Endoscopy',
    aliases: ['UBT', 'Urea Breath Test'],
    fields: [
      { key: 'ubtResult', label: 'UBT Result', unit: '', normalLow: null, normalHigh: null },
    ],
  },

  'Stool Occult Blood': {
    category: 'Microbiology',
    aliases: ['Occult Blood', 'FOBT'],
    fields: [
      { key: 'occultBlood', label: 'Occult Blood', unit: '', normalLow: null, normalHigh: null },
    ],
  },

  'Stool Examination': {
    category: 'Stool',
    aliases: ['Stool Routine'],
    fields: [
      { key: 'colour',        label: 'Colour',         unit: '',     normalLow: null, normalHigh: null },
      { key: 'consistency',   label: 'Consistency',    unit: '',     normalLow: null, normalHigh: null },
      { key: 'mucus',         label: 'Mucus',          unit: '',     normalLow: null, normalHigh: null },
      { key: 'blood',         label: 'Blood',          unit: '',     normalLow: null, normalHigh: null },
      { key: 'pusCells',      label: 'Pus Cells',      unit: '/HPF', normalLow: 0, normalHigh: 5 },
      { key: 'rbc',           label: 'RBC',            unit: '/HPF', normalLow: 0, normalHigh: 0 },
      { key: 'parasites',     label: 'Parasites/Cysts', unit: '',    normalLow: null, normalHigh: null },
      { key: 'occultBlood',   label: 'Occult Blood',   unit: '',     normalLow: null, normalHigh: null },
    ],
  },

  // ──────────────────────────────────────────────────────────────────
  // PREGNANCY MARKERS (the lab test ones, not imaging)
  // ──────────────────────────────────────────────────────────────────

  'Pregnancy Test (Urine)': {
    category: 'Other',
    aliases: ['UPT', 'Urine Pregnancy Test', 'Pregnancy Test (Urine β-hCG)'],
    fields: [
      { key: 'upt', label: 'Urine Pregnancy Test', unit: '', normalLow: null, normalHigh: null },
    ],
  },

  'Serum β-hCG': {
    category: 'Other',
    aliases: ['Beta hCG', 'beta-hCG', 'Beta hCG (Quantitative)'],
    fields: [
      { key: 'betaHCG', label: 'Beta hCG (Quantitative)', unit: 'mIU/mL', normalLow: null, normalHigh: null },
    ],
  },

  'Double Marker (NT + Bio)': {
    category: 'Pregnancy & Antenatal',
    aliases: ['Double Marker', 'NT Bio'],
    fields: [
      { key: 'pappA',       label: 'PAPP-A',           unit: 'MoM',  normalLow: 0.5, normalHigh: 2.0 },
      { key: 'freeBetaHCG', label: 'Free Beta hCG',    unit: 'MoM',  normalLow: 0.5, normalHigh: 2.0 },
      { key: 'risk',        label: 'Risk for Trisomy', unit: '',     normalLow: null, normalHigh: null },
    ],
  },

  'Triple Marker Test': {
    category: 'Pregnancy & Antenatal',
    aliases: ['Triple Marker'],
    fields: [
      { key: 'afp',     label: 'AFP',           unit: 'MoM', normalLow: 0.5, normalHigh: 2.0 },
      { key: 'hcg',     label: 'hCG',           unit: 'MoM', normalLow: 0.5, normalHigh: 2.0 },
      { key: 'ue3',     label: 'uE3 (Estriol)', unit: 'MoM', normalLow: 0.5, normalHigh: 2.0 },
      { key: 'risk',    label: 'Risk',          unit: '',    normalLow: null, normalHigh: null },
    ],
  },

  'Quadruple Marker Test': {
    category: 'Pregnancy & Antenatal',
    aliases: ['Quad Marker', 'Quadruple Marker'],
    fields: [
      { key: 'afp',      label: 'AFP',           unit: 'MoM', normalLow: 0.5, normalHigh: 2.0 },
      { key: 'hcg',      label: 'hCG',           unit: 'MoM', normalLow: 0.5, normalHigh: 2.0 },
      { key: 'ue3',      label: 'uE3 (Estriol)', unit: 'MoM', normalLow: 0.5, normalHigh: 2.0 },
      { key: 'inhibinA', label: 'Inhibin-A',     unit: 'MoM', normalLow: 0.5, normalHigh: 2.0 },
      { key: 'risk',     label: 'Risk',          unit: '',    normalLow: null, normalHigh: null },
    ],
  },

  'OGTT in Pregnancy (75g)': {
    category: 'Pregnancy & Antenatal',
    aliases: ['OGTT Pregnancy', 'GDM Test'],
    fields: [
      { key: 'fastingGlucose', label: 'Fasting Glucose',  unit: 'mg/dL', normalLow: 0, normalHigh: 92 },
      { key: 'oneHrGlucose',   label: '1 Hour Glucose',   unit: 'mg/dL', normalLow: 0, normalHigh: 180 },
      { key: 'twoHrGlucose',   label: '2 Hour Glucose',   unit: 'mg/dL', normalLow: 0, normalHigh: 153 },
    ],
  },

  // ──────────────────────────────────────────────────────────────────
  // PULMONOLOGY (Spirometry has structured values)
  // ──────────────────────────────────────────────────────────────────

  'PFT / Spirometry': {
    category: 'Pulmonology',
    aliases: ['PFT', 'Spirometry', 'Pulmonary Function Test'],
    fields: [
      { key: 'fev1',         label: 'FEV1',                  unit: 'L',  normalLow: null, normalHigh: null },
      { key: 'fvc',          label: 'FVC',                   unit: 'L',  normalLow: null, normalHigh: null },
      { key: 'fev1Fvc',      label: 'FEV1/FVC Ratio',        unit: '%',  normalLow: 70,   normalHigh: null },
      { key: 'pef',          label: 'PEF',                   unit: 'L/s', normalLow: null, normalHigh: null },
      { key: 'fef25_75',     label: 'FEF 25-75%',            unit: 'L/s', normalLow: null, normalHigh: null },
      { key: 'interpretation', label: 'Interpretation',      unit: '',   normalLow: null, normalHigh: null },
    ],
  },

  '6-Minute Walk Test': {
    category: 'Pulmonology',
    aliases: ['6MWT', 'Six Minute Walk'],
    fields: [
      { key: 'distanceMeters',    label: 'Distance Walked', unit: 'meters', normalLow: 400, normalHigh: null },
      { key: 'spo2Pre',           label: 'SpO2 Pre',        unit: '%',      normalLow: 95,  normalHigh: 100 },
      { key: 'spo2Post',          label: 'SpO2 Post',       unit: '%',      normalLow: 90,  normalHigh: 100 },
      { key: 'borgScale',         label: 'Borg Dyspnoea',   unit: '',       normalLow: 0,   normalHigh: 3 },
    ],
  },

};

// ─── findTemplate helper ─────────────────────────────────────────────
//
// Try to match a test name to a template. Resolution order:
//   1. Exact match on key (case-insensitive, trimmed)
//   2. Exact match on any declared alias
//   3. Substring containment (loose match) -- last resort, only for inputs
//      with at least one word of length >= 4 to avoid false matches like
//      "test" matching "Kidney Function Test".
// Returns null if no match.
function findTemplate(testName) {
  if (!testName) return null;
  const lower = testName.toLowerCase().trim();
  if (lower.length < 2) return null;

  // 1. Exact key match
  for (const [key, val] of Object.entries(LAB_TEST_TEMPLATES)) {
    if (key.toLowerCase().trim() === lower) return val;
  }

  // 2. Alias match (any template's aliases array)
  for (const val of Object.values(LAB_TEST_TEMPLATES)) {
    if (Array.isArray(val.aliases)) {
      for (const alias of val.aliases) {
        if (alias.toLowerCase().trim() === lower) return val;
      }
    }
  }

  // 3. Substring containment -- but only if the input has a meaningfully
  // long word. "test" alone (4 chars but a generic English word) skips
  // this step. We require either (a) input is >= 8 chars, or (b) input
  // is structurally specific (contains parens, slashes, hyphens, or
  // starts with capital-only abbreviation).
  const isStructural = /[()\/\-]/.test(testName) ||
                       /^[A-Z]{2,}\b/.test(testName.trim()) ||
                       lower.length >= 8;
  if (!isStructural) return null;

  // Try aliases first (more specific than keys)
  for (const val of Object.values(LAB_TEST_TEMPLATES)) {
    if (Array.isArray(val.aliases)) {
      for (const alias of val.aliases) {
        const aLower = alias.toLowerCase().trim();
        if (aLower.length < 4) continue;  // skip very short aliases for fuzzy
        if (lower.includes(aLower) || aLower.includes(lower)) {
          return val;
        }
      }
    }
  }
  for (const [key, val] of Object.entries(LAB_TEST_TEMPLATES)) {
    const kLower = key.toLowerCase().trim();
    if (kLower.length < 4) continue;
    if (lower.includes(kLower) || kLower.includes(lower)) return val;
  }

  return null;
}

module.exports = { LAB_TEST_TEMPLATES, findTemplate };
