import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import api from '../../lib/api'

/**
 * TemplatePicker — fetches templates of a given type, lets user pick one,
 * fires onPick(template) so the parent form pre-fills its fields.
 *
 * Props:
 *   type    'FITNESS_CERT' | 'MEDICAL_CERT' | 'REFERRAL'
 *   onPick  (template) => void
 */
export default function TemplatePicker({ type, onPick }) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading]     = useState(false)
  const [selectedId, setSelectedId] = useState('')

  useEffect(() => {
    if (!type) return
    setLoading(true)
    api.get(`/document-templates?type=${type}`, { silent: true })
      .then(res => setTemplates(Array.isArray(res?.data?.data) ? res.data.data : []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false))
  }, [type])

  if (loading) {
    return <p className="text-xs text-slate-400 italic">Loading templates…</p>
  }
  if (!templates.length) {
    return (
      <p className="text-xs text-slate-400 italic">
        No templates yet. Admin can add reusable templates from Settings → Cert Templates.
      </p>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Sparkles className="w-4 h-4 text-primary flex-shrink-0"/>
      <span className="text-xs font-semibold text-slate-600 flex-shrink-0">Use template:</span>
      <select
        className="form-select text-sm flex-1"
        value={selectedId}
        onChange={(e) => {
          const id = e.target.value
          setSelectedId(id)
          if (!id) return
          const tpl = templates.find(t => t.id === id)
          if (tpl) onPick(tpl)
        }}
      >
        <option value="">— Choose a template —</option>
        {templates.map(t => (
          <option key={t.id} value={t.id}>
            {t.isDefault ? '★ ' : ''}{t.name}
          </option>
        ))}
      </select>
    </div>
  )
}
