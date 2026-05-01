// Filename-safe slug helper.
//
// Turns "Sumit Mhetre" -> "Sumit-Mhetre"
// Turns "Dr. Rajesh Sharma" -> "Dr-Rajesh-Sharma"
// Strips characters that browsers / file systems hate: / \ : * ? " < > |
// Collapses whitespace into single hyphens. Trims leading/trailing hyphens.
//
// Used by usePrintTitle() to build clean download filenames for receipts,
// prescriptions, and IPD print pages.

export function slugifyForFilename(input, opts = {}) {
  const { fallback = '' } = opts
  if (input == null) return fallback
  let s = String(input).normalize('NFKD').replace(/[\u0300-\u036f]/g, '') // strip accents
  s = s.replace(/[\\/:*?"<>|]+/g, '')      // strip Windows-illegal chars
  s = s.replace(/[\u0000-\u001f\u007f]/g, '') // strip control chars
  s = s.replace(/\s+/g, '-')                 // spaces -> hyphens
  s = s.replace(/-+/g, '-').replace(/^-|-$/g, '')
  return s || fallback
}

// Build a print-page document.title from common fields. Order matters --
// most identifying piece first so even if filename gets truncated by a UA,
// you can still find the file.
//
// buildPrintTitle('Bill', { id: 'BL-2026-0006', code: 'SHA0001', name: 'Sumit Mhetre' })
//   -> "Bill_BL-2026-0006_SHA0001_Sumit-Mhetre"
export function buildPrintTitle(kind, parts = {}) {
  const segments = [kind]
  if (parts.id)   segments.push(slugifyForFilename(parts.id))
  if (parts.code) segments.push(slugifyForFilename(parts.code))
  if (parts.name) segments.push(slugifyForFilename(parts.name))
  if (parts.date) segments.push(slugifyForFilename(parts.date))
  return segments.filter(Boolean).join('_')
}

export default slugifyForFilename
