import React, { memo, useEffect, useRef, useState } from 'react'
import { NodeResizer } from '@xyflow/react'
import { ChevronDown, ChevronRight, X } from 'lucide-react'
import { canvasCommands } from '../core/canvasCommands'

// Group container (Phase 8). Non-draggable backdrop sized from member bounds
// (see refreshGroupBoxes); the header renames/collapses/ungroups. Members are
// referenced by id, not RF parenting, so save/validation payloads filter to
// real blocks with one predicate (document.js isBlockNode).
export const CanvasGroup = memo(function CanvasGroup({ id, data, selected }) {
  const color = data?.color || '#8b5cf6'
  const collapsed = !!data?.collapsed
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data?.label || '')
  const inputRef = useRef(null)

  useEffect(() => {
    if (!editing) setDraft(data?.label || '')
  }, [data?.label, editing])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const commit = () => {
    const label = draft.trim()
    if (label && label !== (data?.label || '')) canvasCommands.renameGroup(id, label)
    setEditing(false)
  }

  return (
    <>
      <NodeResizer
        minWidth={200}
        minHeight={collapsed ? 44 : 120}
        isVisible={!!selected}
        lineClassName="!border-resonance-accent"
        handleClassName="!w-2 !h-2 !bg-resonance-bg-elevated !border !border-resonance-accent !rounded-sm"
      />
      <div
        className={`h-full w-full rounded-xl border bg-resonance-bg-elevated/40 ${selected ? 'border-resonance-accent' : 'border-resonance-border'}`}
        style={{ borderTop: `3px solid ${color}` }}
      >
        <div className="nodrag flex items-center gap-1.5 px-2.5 py-2">
          <button
            onClick={(e) => { e.stopPropagation(); canvasCommands.toggleGroupCollapse(id) }}
            title={collapsed ? 'Expand group' : 'Collapse group'}
            aria-label={collapsed ? `Expand ${data?.label || 'group'}` : `Collapse ${data?.label || 'group'}`}
            className="rounded p-0.5 text-resonance-text-muted transition-colors hover:bg-resonance-bg-hover hover:text-resonance-text-primary"
          >
            {collapsed ? <ChevronRight size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
          </button>
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') commit()
                else if (e.key === 'Escape') { setDraft(data?.label || ''); setEditing(false) }
              }}
              onClick={(e) => e.stopPropagation()}
              aria-label="Group name"
              data-canvas-input="true"
              className="nodrag w-32 rounded bg-resonance-bg-tertiary px-1 py-0.5 text-xs font-semibold text-resonance-text-primary focus:outline-none focus:ring-2 focus:ring-resonance-accent/40"
            />
          ) : (
            <button
              onDoubleClick={(e) => { e.stopPropagation(); setDraft(data?.label || ''); setEditing(true) }}
              title="Double-click to rename"
              className="truncate text-xs font-semibold text-resonance-text-primary"
            >
              {data?.label || 'Group'}
            </button>
          )}
          <span className="text-[10px tabular-nums] text-resonance-text-muted">{data?.memberCount ?? data?.nodeIds?.length ?? 0}</span>
          <button
            onClick={(e) => { e.stopPropagation(); canvasCommands.ungroup(id) }}
            title="Ungroup"
            aria-label={`Ungroup ${data?.label || 'group'}`}
            className="ml-auto rounded p-0.5 text-resonance-text-muted transition-colors hover:bg-resonance-bg-hover hover:text-resonance-error"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </div>
      </div>
    </>
  )
})
