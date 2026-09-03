import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, MessageCircle, Pencil, Copy, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'

/*
  Shared design card, used on the home landing ("Recent Designs") and the
  Designs dashboard. Compact card: status badge + score ring, name/description,
  Last Sim / Cost / Blocks / Edges metrics, team avatars, hover actions.
  Action buttons render only when the corresponding handler is passed.
*/

const ACCENT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7'
]

export const getRandomAccent = () => ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)]

const STATUS_VARIANT = { production: 'success', review: 'warning', draft: 'draft', archived: 'default' }
const STATUS_LABEL = { production: 'Production', review: 'In Review', draft: 'Draft', archived: 'Archived' }

const scoreColor = (score) =>
  score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : score > 0 ? '#ef4444' : 'rgb(var(--border-color-rgb))'

const AVATAR_STYLES = [
  { backgroundColor: '#DCFC5C', color: '#000000' },
  { backgroundColor: '#6B7280', color: '#ffffff' },
  { backgroundColor: '#9CA3AF', color: '#ffffff' },
]

const MetricTile = ({ label, value, suffix, sub }) => (
  <div className="rounded-lg bg-resonance-bg-tertiary px-2.5 py-1.5 min-w-0">
    <div className="text-[10px] uppercase tracking-wider text-resonance-text-muted truncate">{label}</div>
    <div className="text-[13px] font-bold tabular-nums text-resonance-text-primary truncate">
      {value}
      {suffix && <span className="text-[10px] font-normal text-resonance-text-muted"> {suffix}</span>}
    </div>
    {sub && <div className="text-[10px] text-resonance-text-muted truncate">{sub}</div>}
  </div>
)

export const DesignCard = ({ design, onChat, onEdit, onDuplicate, onDelete }) => {
  const navigate = useNavigate()
  const team = design.team || []

  const stop = (fn) => (e) => {
    e.stopPropagation()
    fn()
  }
  const actionBtn = 'p-1.5 rounded-md bg-resonance-bg-elevated border border-resonance-border transition-all'
  const neutralBtn = 'text-resonance-text-secondary hover:text-resonance-text-primary hover:bg-resonance-bg-hover'

  return (
    <div
      onClick={() => navigate(`/designs/${design.id}`)}
      className="group relative bg-resonance-bg-secondary border border-resonance-border rounded-xl p-4 cursor-pointer hover:border-resonance-accent/40 hover:-translate-y-0.5 transition-all duration-150"
    >
      {/* Status + score */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <Badge variant={STATUS_VARIANT[design.status] || 'draft'}>
            {STATUS_LABEL[design.status] || 'Draft'}
          </Badge>
          {design.teamId && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-resonance-accent/10 text-resonance-accent">
              Team
            </span>
          )}
        </div>
        <div
          className="w-9 h-9 rounded-full border-2 flex items-center justify-center text-[11px] font-bold tabular-nums shrink-0"
          style={{ borderColor: scoreColor(design.score), color: design.score ? undefined : 'rgb(var(--text-muted-rgb))' }}
        >
          {design.score || '—'}
        </div>
      </div>

      {/* Name + description */}
      <h3 className="text-sm font-semibold text-resonance-text-primary truncate">{design.name}</h3>
      <p className="text-xs text-resonance-text-secondary line-clamp-2 mt-0.5">
        {design.description || 'No description'}
      </p>

      {/* Metrics */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <MetricTile label="Last Sim" value={design.lastSim || '—'} sub={design.scenario} />
        <MetricTile label="Cost" value={design.projectedCost ?? '—'} suffix="/mo" />
        <MetricTile label="Blocks" value={design.blocks ?? 0} sub="nodes" />
        <MetricTile label="Edges" value={design.edges ?? 0} sub="connections" />
      </div>

      {/* Footer: team avatars + hover actions */}
      <div className="mt-3 pt-3 border-t border-resonance-border flex items-center justify-between gap-2">
        <div className="flex items-center min-w-0">
          {team.length > 0 ? (
            <>
              {team.slice(0, 3).map((member, i) => (
                <div
                  key={i}
                  className="w-6 h-6 rounded-full border-2 border-resonance-bg-secondary flex items-center justify-center text-[9px] font-bold -ml-2 first:ml-0 shrink-0"
                  style={AVATAR_STYLES[i] || AVATAR_STYLES[AVATAR_STYLES.length - 1]}
                >
                  {member.initials}
                </div>
              ))}
              {team.length > 3 && (
                <span className="ml-1 text-[9px] font-medium text-resonance-text-secondary">
                  +{team.length - 3}
                </span>
              )}
            </>
          ) : (
            <span className="text-xs text-resonance-text-secondary truncate">
              Updated {design.updatedAtLabel || design.lastSim || '—'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {onChat && (
            <button
              type="button"
              onClick={stop(() => onChat(design))}
              title="Chat about this design"
              className={`${actionBtn} text-resonance-accent hover:bg-resonance-bg-hover`}
            >
              <MessageCircle size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={stop(() => navigate(`/design/${design.id}`))}
            title="Open in Canvas Editor"
            className={`${actionBtn} ${neutralBtn}`}
          >
            <ArrowUpRight size={14} />
          </button>
          {onEdit && (
            <button
              type="button"
              onClick={stop(() => onEdit(design))}
              title="Edit details"
              className={`${actionBtn} ${neutralBtn}`}
            >
              <Pencil size={14} />
            </button>
          )}
          {onDuplicate && (
            <button
              type="button"
              onClick={stop(() => onDuplicate(design))}
              title="Duplicate"
              className={`${actionBtn} ${neutralBtn}`}
            >
              <Copy size={14} />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={stop(() => onDelete(design.id))}
              title="Delete"
              className={`${actionBtn} text-resonance-text-secondary hover:text-red-500 hover:bg-red-500/10`}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
