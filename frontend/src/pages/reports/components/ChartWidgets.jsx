import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, RadialBarChart, RadialBar,
} from 'recharts'

export const COLORS = ['#1565C0', '#00BCD4', '#42A5F5', '#43A047', '#FB8C00', '#E53935', '#8B5CF6', '#EC4899', '#14B8A6', '#F59E0B']

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
const numFmt = (n) => Number(n || 0).toLocaleString('en-IN')

// ── Generic wrapper ─────────────────────────
export function ChartCard({ title, subtitle, action, children, height = 300, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-5 ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-bold text-slate-800 text-sm">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div style={{ width: '100%', height }}>
        {children}
      </div>
    </div>
  )
}

// ── Area (revenue trend) ─────────────────────
export function TrendAreaChart({ data, xKey = 'date', lines = [] }) {
  return (
    <ResponsiveContainer>
      <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <defs>
          {lines.map((l, i) => (
            <linearGradient id={`grad-${l.key}`} x1="0" y1="0" x2="0" y2="1" key={l.key}>
              <stop offset="0%" stopColor={l.color || COLORS[i]} stopOpacity={0.35} />
              <stop offset="100%" stopColor={l.color || COLORS[i]} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
        <XAxis dataKey={xKey} stroke="#94A3B8" fontSize={11} tickFormatter={formatShortDate}/>
        <YAxis stroke="#94A3B8" fontSize={11} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}/>
        <Tooltip content={<CustomTooltip currency={lines.some(l => l.currency)} />} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }}/>
        {lines.map((l, i) => (
          <Area
            key={l.key}
            type="monotone"
            dataKey={l.key}
            name={l.label || l.key}
            stroke={l.color || COLORS[i]}
            strokeWidth={2}
            fill={`url(#grad-${l.key})`}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Bar (footfall) ─────────────────────────
export function SimpleBarChart({ data, xKey = 'date', yKey = 'patients', color = '#00BCD4', label = '' }) {
  return (
    <ResponsiveContainer>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false}/>
        <XAxis dataKey={xKey} stroke="#94A3B8" fontSize={11} tickFormatter={formatShortDate}/>
        <YAxis stroke="#94A3B8" fontSize={11}/>
        <Tooltip content={<CustomTooltip />}/>
        <Bar dataKey={yKey} name={label || yKey} fill={color} radius={[6, 6, 0, 0]}/>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Horizontal bar (top lists) ─────────────
export function HBarChart({ data, xKey = 'count', yKey = 'name', color = '#1565C0', formatter }) {
  return (
    <ResponsiveContainer>
      <BarChart data={data} layout="vertical" margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false}/>
        <XAxis type="number" stroke="#94A3B8" fontSize={11}/>
        <YAxis type="category" dataKey={yKey} stroke="#475569" fontSize={11} width={120} interval={0}/>
        <Tooltip formatter={formatter}/>
        <Bar dataKey={xKey} fill={color} radius={[0, 6, 6, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Donut ──────────────────────────────────
export function DonutChart({ data, labelKey = 'name', valueKey = 'value', currency = false }) {
  return (
    <ResponsiveContainer>
      <PieChart>
        <Pie
          data={data}
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
          dataKey={valueKey}
          nameKey={labelKey}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]}/>
          ))}
        </Pie>
        <Tooltip formatter={(val) => currency ? inr(val) : numFmt(val)}/>
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }}/>
      </PieChart>
    </ResponsiveContainer>
  )
}

// ── Radial (age groups) ───────────────────
export function RadialChart({ data }) {
  return (
    <ResponsiveContainer>
      <RadialBarChart
        innerRadius="20%" outerRadius="95%"
        data={data.map((d, i) => ({ ...d, fill: COLORS[i % COLORS.length] }))}
        startAngle={90} endAngle={-270}
      >
        <RadialBar minAngle={5} background clockWise dataKey="value"/>
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} align="right" verticalAlign="middle" layout="vertical"/>
        <Tooltip/>
      </RadialBarChart>
    </ResponsiveContainer>
  )
}

// ── Line chart (multi-series) ─────────────
export function MultiLineChart({ data, xKey = 'date', lines = [] }) {
  return (
    <ResponsiveContainer>
      <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false}/>
        <XAxis dataKey={xKey} stroke="#94A3B8" fontSize={11} tickFormatter={formatShortDate}/>
        <YAxis stroke="#94A3B8" fontSize={11}/>
        <Tooltip content={<CustomTooltip/>}/>
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }}/>
        {lines.map((l, i) => (
          <Line
            key={l.key}
            type="monotone"
            dataKey={l.key}
            name={l.label || l.key}
            stroke={l.color || COLORS[i]}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 6 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── Peak hours heatmap (simple bar) ───────
export function HeatmapHours({ data }) {
  // data: array of 24 numbers
  const max = Math.max(...data, 1)
  return (
    <div className="grid grid-cols-24 gap-1 w-full" style={{ gridTemplateColumns: 'repeat(24, 1fr)' }}>
      {data.map((n, h) => {
        const intensity = n / max
        const bg = n === 0
          ? '#F1F5F9'
          : `rgba(21, 101, 192, ${Math.max(0.15, intensity)})`
        return (
          <div
            key={h}
            title={`${h}:00 - ${n} visits`}
            className="h-10 rounded flex items-end justify-center text-[10px] font-semibold"
            style={{
              background: bg,
              color: intensity > 0.4 ? 'white' : '#334155',
            }}
          >
            {h}
          </div>
        )
      })}
    </div>
  )
}

// ── Custom tooltip ─────────────────────────
function CustomTooltip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 shadow-lg rounded-lg p-2.5 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{formatShortDate(label)}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }}/>
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-semibold text-slate-800">
            {currency ? inr(p.value) : numFmt(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

function formatShortDate(s) {
  if (!s || typeof s !== 'string') return s
  const parts = s.split('-')
  if (parts.length !== 3) return s
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${parseInt(parts[2], 10)} ${MONTHS[parseInt(parts[1], 10) - 1]}`
}
