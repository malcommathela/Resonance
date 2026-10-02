import React, { memo, useEffect, useRef, useState } from 'react'
import { NodeResizer } from '@xyflow/react'
import { ChevronDown, ChevronRight, X } from 'lucide-react'
import { useCanvasStore } from '@/stores/canvasStore'
import { canvasCommands } from '../core/canvasCommands'
import { GROUP_DRAG_HANDLE, GROUP_MIN_W, GROUP_MIN_H, COLLAPSED_H } from './meta'

// Background group container: passive selectable surface + drag-handle header
// + NodeResizer. Members are referenced by id, not RF parenting, so
// save/validation payloads filter to real blocks with one predicate
// (document.js isBlockNode). Paint order comes from store zIndex values
// (meta GROUP_Z_INDEX/NODE_Z_INDEX) under zIndexMode="manual".
export const CanvasGroup = memo(function CanvasGroup({ id, data, selected }) {
  const collapsed = !!data?.collapsed
  const isDropTarget = useCanvasStore((s) => s.groupDropTarget === id)
  const isEmpty = (data?.nodeIds?.length ?? 0) === 0
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
    if (label) canvasCommands.renameGroup(id, label)
    else canvasCommands.renameGroup(id, data?.label || 'Group')
    setEditing(false)
  }

  const cancel = () => {
    // Clears a pending justCreated without a history entry (same-label path).
    canvasCommands.renameGroup(id, data?.label || 'Group')
    setDraft(data?.label || '')
    setEditing(false)
  }

  // Focus the name immediately after creation (n8n-style); Esc cancels.
  useEffect(() => {
    if (data?.justCreated && !editing) {
      setDraft(data?.label || '')
      setEditing(true)
    }
  }, [data?.justCreated]) // eslint-disable-line react-hooks/exhaustive-deps

  // Resize lifecycle lives on the NodeResizer itself (<ReactFlow> has no
  // onResizeStart/onResizeEnd props — passing them there warns and never
  // fires, so the single-undo commit + grow-to-fit never ran). Capture the
  // pre-resize size here; the commit reconstructs true pre-state from it.
  const resizeStartRef = useRef(null)

  return (
    <>
      <NodeResizer
        minWidth={GROUP_MIN_W}
        minHeight={collapsed ? COLLAPSED_H : GROUP_MIN_H}
        isVisible={!!selected}
        lineClassName="!border-resonance-text-muted"
        handleClassName="!w-2 !h-2 !bg-resonance-bg-elevated !border !border-resonance-text-muted !rounded-sm"
        onResizeStart={(_, params) => { resizeStartRef.current = { ...(params || {}) } }}
        onResizeEnd={() => {
          canvasCommands.resizeGroup(id, resizeStartRef.current)
          resizeStartRef.current = null
        }}
      />
      <div
        className={`h-full w-full rounded-2xl border bg-resonance-bg-elevated/40 ${selected || isDropTarget ? 'border-resonance-text-muted' : 'border-transparent'}`}
      >
        {/* Header is the drag surface (RF dragHandle restricts drag starts to
            it); the background is selectable but otherwise passive, so nodes,
            edges, and badges above it keep their interactions. */}
        <div className={`${GROUP_DRAG_HANDLE} flex cursor-grab items-center gap-1.5 px-2.5 py-2 active:cursor-grabbing`}>
          <button
            onClick={(e) => { e.stopPropagation(); canvasCommands.toggleGroupCollapse(id) }}
            title={collapsed ? 'Expand group' : 'Collapse group'}
            aria-label={collapsed ? `Expand ${data?.label || 'group'}` : `Collapse ${data?.label || 'group'}`}
            className="nodrag rounded p-0.5 text-resonance-text-muted transition-colors hover:bg-resonance-bg-hover hover:text-resonance-text-primary"
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
                else if (e.key === 'Escape') cancel()
              }}
              onClick={(e) => e.stopPropagation()}
              aria-label="Group name"
              data-canvas-input="true"
              className="nodrag w-40 rounded bg-resonance-bg-tertiary px-1 py-0.5 text-sm font-semibold text-resonance-text-primary focus:outline-none focus:ring-2 focus:ring-resonance-accent/40"
            />
          ) : (
            <button
              onDoubleClick={(e) => { e.stopPropagation(); setDraft(data?.label || ''); setEditing(true) }}
              title="Double-click to rename"
              className="nodrag truncate text-sm font-semibold text-resonance-text-primary"
            >
              {data?.label || 'Group'}
            </button>
          )}
          <span className="text-xs tabular-nums text-resonance-text-muted">{data?.memberCount ?? data?.nodeIds?.length ?? 0}</span>
          <button
            onClick={(e) => { e.stopPropagation(); canvasCommands.ungroup(id) }}
            title="Ungroup"
            aria-label={`Ungroup ${data?.label || 'group'}`}
            className="nodrag ml-auto rounded p-0.5 text-resonance-text-muted transition-colors hover:bg-resonance-bg-hover hover:text-resonance-error"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </div>
        {isEmpty && !collapsed && (
          <p className="pointer-events-none px-3 pb-3 pt-1 text-center text-xs text-resonance-text-muted">
            Drop services here
          </p>
        )}
      </div>
    </>
  )
})
