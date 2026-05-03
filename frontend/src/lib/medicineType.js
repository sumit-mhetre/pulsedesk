// Mirror of backend/src/lib/medicineType.js. Keep in sync.
// Used by the prescription page and Master Data form to auto-fill the
// medicine type dropdown as the user types the name.

const TYPE_PREFIXES = {
  // tablet
  'tab':     'tablet',  'tab.':    'tablet',
  'tabs':    'tablet',  'tabs.':   'tablet',
  'tablet':  'tablet',  'tablets': 'tablet',
  // capsule
  'cap':     'capsule', 'cap.':    'capsule',
  'caps':    'capsule', 'caps.':   'capsule',
  'capsule': 'capsule', 'capsules':'capsule',
  // liquid
  'syr':     'liquid',  'syr.':    'liquid',
  'syp':     'liquid',  'syp.':    'liquid',
  'syrup':   'liquid',  'syrups':  'liquid',
  'susp':    'liquid',  'susp.':   'liquid',
  'suspension': 'liquid',
  'liquid':  'liquid',
  // drops
  'drop':    'drops',   'drops':   'drops',
  'drp':     'drops',   'drp.':    'drops',
  // cream
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
  // sachet / powder
  'sachet':  'sachet',  'pwd':     'sachet',  'pwd.':   'sachet',
  'powder':  'sachet',
}

export function detectMedicineType(name) {
  if (!name || typeof name !== 'string') return null
  const trimmed = name.trim().toLowerCase()
  if (!trimmed) return null
  const firstToken = trimmed.split(/\s+/)[0]
  if (TYPE_PREFIXES[firstToken]) return TYPE_PREFIXES[firstToken]
  const tokens = trimmed.split(/\s+/)
  for (const t of tokens) {
    if (TYPE_PREFIXES[t]) return TYPE_PREFIXES[t]
  }
  return null
}
