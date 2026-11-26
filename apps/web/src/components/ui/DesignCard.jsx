import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, MessageCircle, Pencil, Copy, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'

const ACCENT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7'
]

export const getRandomAccent = () => ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)]

const STATUS_VARIANT = { production: 'success', review: 'warning', draft: 'draft', archived: 'default' }
const STATUS_LABEL = { production: 'Production', review: 'In Review', draft: 'Draft', archived: 'Archived' }

const scoreColor = (score) =>
  score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : score > 0 ? '#ef4444' : 'hsl(var(--border))'

const AVATAR_CLASSES = [
  'bg-primary text-primary-foreground',
  'bg-secondary text-secondary-foreground',
  'bg-muted text-muted-foreground',
]

const MetricTile = ({ label, value, suffix, sub }) => (
  <div className="min-w-0 rounded-lg bg-muted px-2.5 py-1.5">
    <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="truncate text-[13px] font-bold tabular-nums text-foreground">
      {value}
      {suffix && <span className="text-[10px] font-normal text-muted-foreground"> {suffix}</span>}
    </div>
    {sub && <div className="truncate text-[10px] text-muted-foreground">{sub}</div>}
  </div>
)

export const DesignCard = ({ design, onChat, onEdit, onDuplicate, onDelete }) => {
  const navigate = useNavigate()
  const team = design.team || []

  const stop = (fn) => (e) => {
    e.stopPropagation()
    fn()
  }
  const actionBtn = 'p-1.5 rounded-md bg-background border border-border transition-all'
  const neutralBtn = 'text-muted-foreground hover:text-foreground hover:bg-accent'

  return (
    <div
      onClick={() => navigate(`/designs/${design.id}`)}
      className="group relative cursor-pointer rounded-xl border bg-card p-4 text-card-foreground transition-all duration-150 hover:-translate-y-0.5 hover:border-ring/40"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Badge variant={STATUS_VARIANT[design.status] || 'draft'}>
            {STATUS_LABEL[design.status] || 'Draft'}
          </Badge>
          {design.teamId && (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Team
            </span>
          )}
        </div>
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold tabular-nums"
          style={{ borderColor: scoreColor(design.score), color: design.score ? undefined : 'hsl(var(--muted-foreground))' }}
        >
          {design.score || '—'}
        </div>
      </div>

      <h3 className="truncate text-sm font-semibold text-foreground">{design.name}</h3>
      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
        {design.description || 'No description'}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <MetricTile label="Last Sim" value={design.lastSim || '—'} sub={design.scenario} />
        <MetricTile label="Cost" value={design.projectedCost ?? '—'} suffix="/mo" />
        <MetricTile label="Blocks" value={design.blocks ?? 0} sub="nodes" />
        <MetricTile label="Edges" value={design.edges ?? 0} sub="connections" />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
        <div className="flex min-w-0 items-center">
          {team.length > 0 ? (
            <>
              {team.slice(0, 3).map((member, i) => (
                <div
                  key={i}
                  className={`-ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-card text-[9px] font-bold first:ml-0 ${AVATAR_CLASSES[i] || AVATAR_CLASSES[2]}`}
                >
                  {member.initials}
                </div>
              ))}
              {team.length > 3 && (
                <span className="ml-1 text-[9px] font-medium text-muted-foreground">
                  +{team.length - 3}
                </span>
              )}
            </>
          ) : (
            <span className="truncate text-xs text-muted-foreground">
              Updated {design.updatedAtLabel || design.lastSim || '—'}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
          {onChat && (
            <button
              type="button"
              onClick={stop(() => onChat(design))}
              title="Chat about this design"
              className={`${actionBtn} text-primary hover:bg-accent`}
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
              className={`${actionBtn} text-muted-foreground hover:bg-destructive/10 hover:text-destructive`}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
