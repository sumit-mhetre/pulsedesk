// Bed Transfer Modal -- pick a new bed and transfer the admission.
//
// Used from AdmissionDetailPage header (button next to Discharge).

import { useEffect, useState } from 'react'
import { ArrowRightLeft, Save, BedDouble } from 'lucide-react'
import { Button, Modal, Badge, ConfirmDialog } from '../../components/ui'
import api from '../../lib/api'
import toast from 'react-hot-toast'

const BED_TYPE_LABELS = {
  GENERAL: 'General', SEMI_PRIVATE: 'Semi-Private', PRIVATE: 'Private',
  ICU: 'ICU', HDU: 'HDU', LABOUR: 'Labour', DAY_CARE: 'Day-Care',
  ISOLATION: 'Isolation', OTHER: 'Other',
}

function toLocalInput(d) {
  const dt = new Date(d)
  const pad = (n) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

export default function BedTransferModal({ admission, onClose, onSuccess }) {
  const [beds,           setBeds]           = useState([])
  const [loadingBeds,    setLoadingBeds]    = useState(true)
  const [filterWard,     setFilterWard]     = useState('all')
  const [selectedBedId,  setSelectedBedId]  = useState('')
  const [transferredAt,  setTransferredAt]  = useState(toLocalInput(new Date()))
  const [reason,         setReason]         = useState('')
  const [handoverNote,   setHandoverNote]   = useState('')
  const [saving,         setSaving]         = useState(false)
  const [confirming,     setConfirming]     = useState(false)

  useEffect(() => {
    api.get(`/ipd/admissions/${admission.id}/available-beds`)
      .then(r => setBeds(r.data.data || []))
      .catch(() => toast.error('Failed to load available beds'))
      .finally(() => setLoadingBeds(false))
  }, [admission.id])

  const submit = async () => {
    if (!selectedBedId) return toast.error('Select a target bed')
    setSaving(true)
    try {
      await api.post(`/ipd/admissions/${admission.id}/transfer`, {
        toBedId:           selectedBedId,
        transferredAt:     transferredAt,
        reason:            reason.trim() || undefined,
        nurseHandoverNote: handoverNote.trim() || undefined,
      })
      toast.success('Patient transferred successfully')
      onSuccess()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to transfer')
    } finally {
      setSaving(false)
      setConfirming(false)
    }
  }

  // Group beds by ward for display
  const wards = Array.from(new Set(beds.map(b => b.ward || 'Unassigned'))).sort()
  const filteredBeds = filterWard === 'all'
    ? beds
    : beds.filter(b => (b.ward || 'Unassigned') === filterWard)

  const selectedBed = beds.find(b => b.id === selectedBedId)
  const currentBed  = admission.bed

  return (
    <Modal open onClose={onClose} title="Transfer Patient to Another Bed" size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!selectedBedId} loading={saving}
            icon={<ArrowRightLeft className="w-4 h-4"/>}
            onClick={() => setConfirming(true)}>
            Transfer
          </Button>
        </>
      }>

      {/* Current bed */}
      <div className="bg-blue-50 rounded-xl p-3 mb-4">
        <p className="text-xs uppercase font-semibold text-primary mb-1">Currently In</p>
        {currentBed ? (
          <div className="flex items-center gap-2">
            <BedDouble className="w-4 h-4 text-primary"/>
            <span className="font-mono font-semibold">{currentBed.bedNumber}</span>
            <span className="text-sm text-slate-600">
              &bull; {BED_TYPE_LABELS[currentBed.bedType] || currentBed.bedType}
              {currentBed.ward && <> &bull; {currentBed.ward}</>}
            </span>
          </div>
        ) : (
          <p className="text-sm text-slate-500 italic">No bed assigned (unusual state)</p>
        )}
      </div>

      {/* Ward filter */}
      {wards.length > 1 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Filter by ward</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilterWard('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors
                ${filterWard === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-white border border-slate-200 text-slate-600'}`}>
              All ({beds.length})
            </button>
            {wards.map(w => {
              const count = beds.filter(b => (b.ward || 'Unassigned') === w).length
              return (
                <button
                  key={w}
                  onClick={() => setFilterWard(w)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors
                    ${filterWard === w
                      ? 'bg-primary text-white'
                      : 'bg-white border border-slate-200 text-slate-600'}`}>
                  {w} ({count})
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Bed picker */}
      <div className="mb-3">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
          Available beds {loadingBeds ? '(loading...)' : `(${filteredBeds.length})`}
        </p>

        {loadingBeds ? (
          <div className="flex justify-center py-6"><div className="spinner text-primary w-6 h-6"/></div>
        ) : filteredBeds.length === 0 ? (
          <div className="bg-slate-50 rounded-lg p-4 text-center text-sm text-slate-500">
            No vacant beds available right now
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[280px] overflow-y-auto pr-1">
            {filteredBeds.map(b => {
              const isSelected = b.id === selectedBedId
              return (
                <button
                  key={b.id}
                  onClick={() => setSelectedBedId(b.id)}
                  className={`text-left p-2.5 rounded-lg border-2 transition-all
                    ${isSelected
                      ? 'border-primary bg-blue-50 ring-2 ring-primary/20'
                      : 'border-slate-200 bg-white hover:border-primary/40 hover:shadow-sm'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-semibold text-slate-800">{b.bedNumber}</span>
                    <Badge variant={b.status === 'VACANT' ? 'success' : 'accent'}>
                      {b.status}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {BED_TYPE_LABELS[b.bedType] || b.bedType}
                    {b.ward && <> &bull; {b.ward}</>}
                  </p>
                  {b.dailyRate > 0 && (
                    <p className="text-[11px] text-success font-semibold mt-0.5">
                      &#8377;{b.dailyRate.toLocaleString('en-IN')}/day
                    </p>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Form fields */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="form-group">
          <label className="form-label">Transferred At *</label>
          <input type="datetime-local" className="form-input"
            value={transferredAt}
            onChange={e => setTransferredAt(e.target.value)}/>
        </div>
        <div className="form-group">
          <label className="form-label">Reason</label>
          <input className="form-input" value={reason}
            placeholder="e.g. ICU shift, family request"
            onChange={e => setReason(e.target.value)}/>
        </div>
        <div className="form-group col-span-2">
          <label className="form-label">Nursing Handover Note</label>
          <textarea className="form-input" rows={3} value={handoverNote}
            placeholder="Current condition, ongoing meds, special instructions for receiving nurse..."
            onChange={e => setHandoverNote(e.target.value)}/>
        </div>
      </div>

      {/* Bed-rent change warning */}
      {selectedBed && currentBed && selectedBed.dailyRate !== currentBed.dailyRate && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mt-2">
          <p className="text-xs text-warning">
            <strong>Rate change:</strong> &#8377;{currentBed.dailyRate || 0}/day
            &nbsp;-&gt;&nbsp; <strong>&#8377;{selectedBed.dailyRate || 0}/day</strong>.
            Bed rent on the next bill will be calculated using the new rate for all days.
            This is a known v1 simplification (see project docs).
          </p>
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        title="Confirm Transfer?"
        message={
          selectedBed
            ? `Transfer ${admission.patient?.name} from ${currentBed?.bedNumber || 'no bed'} to ${selectedBed.bedNumber}?`
            : 'Transfer?'
        }
        variant="warning"
        confirmLabel="Yes, Transfer"
        cancelLabel="Cancel"
        onConfirm={submit}
        onClose={() => setConfirming(false)}
      />
    </Modal>
  )
}
