// Admissions list — paginated table with status filter, search, date range.
//
// Shows: admission number, patient, doctor, bed, admitted date, status,
// running days, current bed-rent total. Click row → admission detail page.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, RefreshCw, Filter, ClipboardList,
  ChevronLeft, ChevronRight, BedDouble,
} from 'lucide-react'
import { Card, Button, Badge } from '../../components/ui'
import api from '../../lib/api'
import useAuthStore from '../../store/authStore'
import { can } from '../../lib/permissions'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const STATUS_OPTIONS = [
  { value: '',          label: 'All' },
  { value: 'ADMITTED',  label: 'Admitted' },
  { value: 'DISCHARGED',label: 'Discharged' },
  { value: 'DAMA',      label: 'DAMA' },
  { value: 'DEATH',     label: 'Death' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const STATUS_VARIANTS = {
  ADMITTED:        'success',
  DISCHARGED:      'primary',
  DAMA:            'warning',
  DEATH:           'gray',
  TRANSFERRED_OUT: 'accent',
  CANCELLED:       'gray',
}

const STATUS_LABELS = {
  ADMITTED:        'Admitted',
  DISCHARGED:      'Discharged',
  DAMA:            'DAMA',
  DEATH:           'Death',
  TRANSFERRED_OUT: 'Transferred',
  CANCELLED:       'Cancelled',
}

export default function AdmissionsListPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const canAdmit = can(user, 'manageAdmissions')

  const [admissions, setAdmissions] = useState([])
  const [loading, setLoading]       = useState(true)
  const [page, setPage]             = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal]           = useState(0)

  const [search, setSearch]   = useState('')
  const [status, setStatus]   = useState('ADMITTED')   // default to Admitted (most useful)
  const [from, setFrom]       = useState('')
  const [to, setTo]           = useState('')

  const fetchData = async (resetPage = false) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page',  resetPage ? 1 : page)
      params.set('limit', 20)
      if (search) params.set('search', search)
      if (status) params.set('status', status)
      if (from)   params.set('from', from)
      if (to)     params.set('to', to)
      const { data } = await api.get(`/ipd/admissions?${params}`)
      setAdmissions(data.data || [])
      setTotalPages(data.pagination?.totalPages || 1)
      setTotal(data.pagination?.total || 0)
      if (resetPage) setPage(1)
    } catch (err) {
      if (!err?.response?.data?.errors?.ipdDisabled) {
        toast.error('Failed to load admissions')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [page])

  const onFilterApply = () => { setPage(1); fetchData(true) }
  const onClearFilters = () => {
    setSearch(''); setStatus(''); setFrom(''); setTo('')
    setPage(1)
    setTimeout(() => fetchData(true), 0)
  }

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div>
          <h1 className="page-title">Admissions</h1>
          <p className="page-subtitle">All inpatient admissions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" icon={<RefreshCw className="w-4 h-4"/>} onClick={() => fetchData()}>
            Refresh
          </Button>
          {canAdmit && (
            <Button variant="primary" size="sm"
              icon={<Plus className="w-3.5 h-3.5"/>}
              onClick={() => navigate('/ipd/admissions/new')}>
              Admit Patient
            </Button>
          )}
        </div>
      </div>

      {/* Filters - compact single row */}
      <Card className="mb-5 p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-slate-400 flex-shrink-0"/>

          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
            <input className="form-input pl-9 py-2 text-sm" value={search}
              onKeyDown={e => e.key === 'Enter' && onFilterApply()}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search IPD #, name, phone..."/>
          </div>

          <select className="form-select py-2 text-sm w-auto min-w-[140px]"
            value={status} onChange={e => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <input type="date" className="form-input py-2 text-sm w-auto" value={from}
            title="From date"
            onChange={e => setFrom(e.target.value)}/>

          <span className="text-slate-400 text-xs">to</span>

          <input type="date" className="form-input py-2 text-sm w-auto" value={to}
            title="To date"
            onChange={e => setTo(e.target.value)}/>

          <div className="flex gap-1 ml-auto">
            <Button variant="ghost" size="sm" onClick={onClearFilters}>Clear</Button>
            <Button variant="primary" size="sm" onClick={onFilterApply}>Apply</Button>
          </div>
        </div>
      </Card>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="spinner text-primary w-8 h-8"/></div>
      ) : admissions.length === 0 ? (
        <Card className="p-12 text-center">
          <ClipboardList className="w-14 h-14 text-slate-300 mx-auto mb-4"/>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No admissions found</h3>
          <p className="text-sm text-slate-500 mb-4">
            {status || search || from || to
              ? 'No matches for the current filters.'
              : 'No admissions yet.'}
          </p>
          {canAdmit && (
            <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5"/>}
              onClick={() => navigate('/ipd/admissions/new')}>
              Admit First Patient
            </Button>
          )}
        </Card>
      ) : (
        <>
          <Card>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Admission</th>
                    <th>Patient</th>
                    <th>Doctor</th>
                    <th>Bed</th>
                    <th>Admitted</th>
                    <th>Days</th>
                    <th>Bed Rent</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {admissions.map(a => (
                    <tr key={a.id}
                      className="cursor-pointer hover:bg-blue-50/50"
                      onClick={() => navigate(`/ipd/admissions/${a.id}`)}>
                      <td className="font-mono font-semibold text-primary text-sm">{a.admissionNumber}</td>
                      <td>
                        <p className="font-semibold text-slate-800 text-sm">{a.patient?.name}</p>
                        <p className="text-xs text-slate-500">
                          {[a.patient?.patientCode, a.patient?.age != null ? `${a.patient.age}y` : null, a.patient?.gender].filter(Boolean).join(' • ')}
                        </p>
                      </td>
                      <td className="text-slate-700 text-sm">{a.primaryDoctor?.name || '—'}</td>
                      <td>
                        {a.bed ? (
                          <div className="text-xs">
                            <p className="font-semibold text-slate-700"><BedDouble className="w-3 h-3 inline mr-1"/>{a.bed.bedNumber}</p>
                            <p className="text-slate-500">{a.bed.ward || '—'}</p>
                          </div>
                        ) : <span className="text-slate-400 text-xs italic">Released</span>}
                      </td>
                      <td className="text-xs text-slate-600">
                        {format(new Date(a.admittedAt), 'd MMM yy')}
                        <br/>
                        <span className="text-slate-400">{format(new Date(a.admittedAt), 'hh:mm a')}</span>
                      </td>
                      <td className="font-semibold text-slate-700">{a.daysAdmitted}</td>
                      <td className="font-semibold text-slate-700">
                        ₹{(a.bedRentTotal || 0).toLocaleString('en-IN')}
                      </td>
                      <td>
                        <Badge variant={STATUS_VARIANTS[a.status] || 'gray'}>
                          {STATUS_LABELS[a.status] || a.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-slate-500">
                Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" disabled={page === 1}
                  icon={<ChevronLeft className="w-3.5 h-3.5"/>}
                  onClick={() => setPage(p => Math.max(1, p - 1))}>
                  Prev
                </Button>
                <Button variant="ghost" size="sm" disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                  Next <ChevronRight className="w-3.5 h-3.5"/>
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
