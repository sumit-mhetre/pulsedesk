// Detects medicine type from a typed name. Used by both:
//   - the master-data create endpoint (inline "use as new medicine" + the
//     Master Data form) so that "Tab. Crocin" auto-fills type=tablet,
//   - the auto-detect helper in the frontend (the file at frontend/src/lib
//     mirrors this logic - keep them in sync).
//
// Strategy: check the FIRST WORD only. A doctor typing "Tab. Crocin 650"
// or "Cap Augmentin" is signalling the type via the prefix - that's a
// stronger signal than a substring anywhere in the name (e.g. "Capsicum"
// shouldn't be treated as a capsule).

const TYPE_PREFIXES = {
  // tablet
  'tab':     'tablet',  'tab.':    'tablet',
  'tabs':    'tablet',  'tabs.':   'tablet',
  'tablet':  'tablet',  'tablets': 'tablet',
  // capsule
  'cap':     'capsule', 'cap.':    'capsule',
  'caps':    'capsule', 'caps.':   'capsule',
  'capsule': 'capsule', 'capsules':'capsule',
  // liquid (syrup / suspension)
  'syr':     'liquid',  'syr.':    'liquid',
  'syp':     'liquid',  'syp.':    'liquid',
  'syrup':   'liquid',  'syrups':  'liquid',
  'susp':    'liquid',  'susp.':   'liquid',
  'suspension': 'liquid',
  'liquid':  'liquid',
  // drops
  'drop':    'drops',   'drops':   'drops',
  'drp':     'drops',   'drp.':    'drops',
  // cream / ointment / gel
  'cream':   'cream',   'crm':     'cream',   'crm.':    'cream',
  'oint':    'cream',   'oint.':   'cream',
  'ointment':'cream',
  'gel':     'cream',
  // injection
  'inj':     'injection', 'inj.':  'injection',
  'injection': 'injection',
  // inhaler
  'inh':     'inhaler', 'inh.':    'inhaler',
  'inhaler': 'inhaler',
  'puff':    'inhaler',
  // powder / sachet
  'sachet':  'sachet',  'pwd':     'sachet',  'pwd.':   'sachet',
  'powder':  'sachet',
};

/**
 * Detects the medicine type from the medicine name.
 * Returns one of: tablet, capsule, liquid, drops, cream, injection, inhaler,
 * sachet, or null if nothing matched (caller should pick a default).
 */
function detectMedicineType(name) {
  if (!name || typeof name !== 'string') return null;
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return null;

  // First token = everything up to the first whitespace
  const firstToken = trimmed.split(/\s+/)[0];
  if (TYPE_PREFIXES[firstToken]) return TYPE_PREFIXES[firstToken];

  // Fall back: check if any token in the name matches a known prefix.
  // Helps with cases like "Crocin Tab" (less common but possible).
  const tokens = trimmed.split(/\s+/);
  for (const t of tokens) {
    if (TYPE_PREFIXES[t]) return TYPE_PREFIXES[t];
  }
  return null;
}

module.exports = { detectMedicineType, TYPE_PREFIXES };
