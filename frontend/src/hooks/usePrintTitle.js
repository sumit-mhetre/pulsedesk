// Hook: usePrintTitle
//
// Sets `document.title` while a page is mounted, then restores the original
// on unmount. Browsers use document.title as the suggested filename when the
// user prints to PDF or saves the page, so this is how we make exports
// inherit a meaningful name like "Discharge_SHA0001_Sumit-Mhetre_IPD-0001"
// instead of the default app title.
//
// Usage:
//   import { usePrintTitle } from '../../hooks/usePrintTitle'
//   import { slugifyForFilename } from '../../lib/slug'
//
//   usePrintTitle(`Bill_${bill.billNo}_${slugifyForFilename(patient.name)}`)

import { useEffect } from 'react'

export function usePrintTitle(title) {
  useEffect(() => {
    if (!title) return undefined
    const original = document.title
    document.title = String(title).slice(0, 240)
    return () => { document.title = original }
  }, [title])
}

export default usePrintTitle
