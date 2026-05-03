import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit2, Trash2, Zap, Search, FileText, Pill, FlaskConical, BookOpen } from 'lucide-react'
import { Card, Button, Badge, PageHeader } from '../../components/ui'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import useAuthStore from '../../store/authStore'

export default function TemplatesPage() {
  const navigate  = useNavigate()
  const { user }  = useAuthStore()
  // A template is "owned" if userId matches me, OR userId is null (legacy
  // shared - treated as owned by everyone in the clinic), OR I am the admin.
  const canModify = (t) => {
    if (!user) return false
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return true
    if (t.userId == null) return true
    return t.userId === user.id
  }
  const [templates, setTemplates] = useState([])
  const [loading,  setLoading]    = useState(true)
  const [search,   setSearch]     = useState('')
  const [deleting, setDeleting]   = useState(null)

  const fetch = async () => {
    try {
      const { data } = await api.get(`/templates?search=${search}`)
      setTemplates(data.data)
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => {
    const t = setTimeout(fetch, 300)
    return () => clearTimeout(t)
  }, [search])

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete template "${name}"?`)) return
    setDeleting(id)
    try {
      await api.delete(`/templates/${id}`)
      toast.success('Template deleted')
      fetch()
    } catch {} finally { setDeleting(null) }
  }

  return (
    <div className="fade-in">
      <PageHeader title="Templates" subtitle="Reusable prescription templates for quick filling"
        action={<Button variant="primary" icon={<Plus className="w-4 h-4"/>} onClick={()=>navigate('/templates/new')}>New Template</Button>}
      />

      {/* Search */}
      <Card className="mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
          <input className="form-input pl-9" placeholder="Search templates..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-20"><div className="spinner text-primary w-8 h-8"/></div>
      ) : templates.length === 0 ? (
        <Card className="text-center py-16">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3"/>
          <p className="font-semibold text-slate-600 mb-1">No templates yet</p>
          <p className="text-sm text-slate-400 mb-4">Create templates for common conditions like Fever, Hypertension, Diabetes etc.</p>
          <Button variant="primary" icon={<Plus className="w-4 h-4"/>} onClick={()=>navigate('/templates/new')}>Create First Template</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => (
            <Card key={t.id} className="hover:shadow-modal transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-800 truncate">{t.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Used {t.usageCount} times</p>
                </div>
                <div className="flex gap-1 ml-2 flex-shrink-0">
                  {canModify(t) ? (
                    <>
                      <button onClick={()=>navigate(`/templates/${t.id}/edit`)}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-blue-50 rounded-lg transition-colors">
                        <Edit2 className="w-3.5 h-3.5"/>
                      </button>
                      <button onClick={()=>handleDelete(t.id, t.name)} disabled={deleting===t.id}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-danger hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5"/>
                      </button>
                    </>
                  ) : (
                    <span className="text-[10px] text-slate-400 px-2 py-1" title="Created by another doctor">Read-only</span>
                  )}
                </div>
              </div>

              {/* Preview */}
              <div className="space-y-2 text-xs">
                {t.complaint && (
                  <div className="flex items-start gap-1.5">
                    <span className="text-slate-400 flex-shrink-0 mt-0.5">CC:</span>
                    <span className="text-slate-600 truncate">{t.complaint.replace('||',',')}</span>
                  </div>
                )}
                {t.diagnosis && (
                  <div className="flex items-start gap-1.5">
                    <span className="text-slate-400 flex-shrink-0 mt-0.5">Dx:</span>
                    <span className="text-slate-600 truncate">{t.diagnosis.replace('||',',')}</span>
                  </div>
                )}
                {t.medicines?.length > 0 && (
                  <div className="flex items-start gap-1.5">
                    <Pill className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5"/>
                    <span className="text-slate-500 truncate">
                      {t.medicines.length} medicine{t.medicines.length>1?'s':''}
                    </span>
                  </div>
                )}
                {t.labTests?.length > 0 && (
                  <div className="flex items-start gap-1.5">
                    <FlaskConical className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5"/>
                    <span className="text-slate-500 truncate">{t.labTests.length} lab test{t.labTests.length>1?'s':''}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-50">
                <Button variant="primary" size="sm" className="w-full" icon={<Zap className="w-3.5 h-3.5"/>}
                  onClick={()=>navigate(`/prescriptions/new?template=${t.id}`)}>
                  Use Template
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
