import React, { memo, useEffect, useRef, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Copy, Pencil, Plus } from 'lucide-react'
import { useCanvasStore } from '@/stores/canvasStore'
import { canvasCommands } from '../core/canvasCommands'
import { blockIconMap } from '@/lib/iconMap'
import { TONE_COLOR, nodeStatus } from './nodeStatus'

// Compact architecture node (Phase 3).
// Card shows icon + name + type + one status dot. Metrics, config chips and
// simulation dashboards live in the inspector + overlays, not on the card.
// Same data shape as the legacy block node (drop-in for the `customBlock` type).
export const ArchitectureNode = memo(function ArchitectureNode({ id, data, selected: rfSelected }) {
  const Icon = blockIconMap[data?.icon] || blockIconMap.Server
  const color = data?.color || '#8b5cf6'

  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId)
  const validationHighlight = useCanvasStore((s) => s.validationHighlight)
  const running = useCanvasStore((s) => s.simulationRunning)
  const runtime = useCanvasStore((s) => s.simulationBlockMetrics[id])

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data?.label || '')
  const inputRef = useRef(null)

  const isSelected = selectedNodeId !== null ? selectedNodeId === id : !!rfSelected
  const highlighted = !!validationHighlight
    && validationHighlight.elementType === 'node'
    && validationHighlight.elementId === id
  const status = nodeStatus({ highlighted, severity: validationHighlight?.severity, running, runtime })
  const dotColor = status.tone === 'idle' ? color : (TONE_COLOR[status.tone] || color)

  // Configured deployment metadata, read verbatim — never invented. Runtime
  // count only while simulating and only when it differs from configured.
  const port = data?.config?.port
  const replicas = data?.config?.replicas
  const liveReplicas = running && runtime?.currentReplicas != null && runtime.currentReplicas !== replicas
    ? runtime.currentReplicas
    : null
  const metaParts = [
    port != null && port !== '' ? `:${port}` : null,
    Number.isInteger(replicas) ? `${replicas} replica${replicas === 1 ? '' : 's'}` : null,
    liveReplicas != null ? `${liveReplicas} live` : null,
  ].filter(Boolean)
  const metaLine = metaParts.join(' · ')

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
    if (label && label !== (data?.label || '')) canvasCommands.renameNode(id, label)
    setEditing(false)
  }

  return (
    <div className="group relative" data-canvas-element="true" data-node-id={id}>
      <Handle
        type="target"
        position={Position.Left}
        aria-label="Input"
        className={`!w-2.5 !h-2.5 !bg-resonance-bg-elevated !border-2 !rounded-full transition-opacity ${isSelected ? '!border-resonance-accent opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        style={{ borderColor: isSelected ? undefined : color }}
      />

      <div
        className={`w-[232px] rounded-xl border bg-resonance-bg-elevated shadow-md transition-shadow hover:shadow-lg ${isSelected ? 'border-resonance-accent ring-1 ring-resonance-accent' : 'border-resonance-border'}`}
        style={highlighted ? { borderColor: dotColor } : { borderLeft: `3px solid ${color}` }}
      >
        <div className="flex items-center gap-2 px-2.5 py-2">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${status.active ? 'arch-node-blink' : ''}`}
            style={{ backgroundColor: dotColor }}
            title={highlighted ? `Validation: ${status.tone}` : status.tone === 'idle' ? (data?.label || 'Block') : status.tone}
          />
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${color}15` }}
          >
            <Icon size={14} style={{ color }} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
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
                aria-label="Block name"
                data-canvas-input="true"
                className="nodrag w-full rounded bg-resonance-bg-tertiary px-1 py-0.5 text-[13px] font-semibold text-resonance-text-primary focus:outline-none focus:ring-2 focus:ring-resonance-accent/40"
              />
            ) : (
              <span className="flex items-center gap-1">
                <span
                  className="truncate text-[13px] font-semibold text-resonance-text-primary"
                  onDoubleClick={(e) => { e.stopPropagation(); setDraft(data?.label || ''); setEditing(true) }}
                  title="Double-click to rename"
                >
                  {data?.label}
                </span>
                <Pencil
                  size={10}
                  aria-hidden="true"
                  onClick={(e) => { e.stopPropagation(); setDraft(data?.label || ''); setEditing(true) }}
                  className="shrink-0 cursor-pointer text-resonance-text-muted opacity-0 transition-opacity group-hover:opacity-100"
                />
              </span>
            )}
            <span className="block truncate text-[11px] capitalize text-resonance-text-muted">
              {(data?.type || 'block').replace(/-/g, ' ')}
            </span>
            {metaLine ? (
              <span className="block truncate text-[10px] text-resonance-text-muted" title={metaLine}>
                {metaLine}
              </span>
            ) : null}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); canvasCommands.openNodePicker(id) }}
            title="Add connected node (opens picker)"
            aria-label={`Add node connected to ${data?.label || 'block'}`}
            className="shrink-0 rounded-md p-1 text-resonance-text-muted opacity-0 transition-opacity hover:bg-resonance-bg-hover hover:text-resonance-accent group-hover:opacity-100 focus-visible:opacity-100"
          >
            <Plus size={12} aria-hidden="true" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); canvasCommands.duplicateNode(id) }}
            title="Duplicate block"
            aria-label={`Duplicate ${data?.label || 'block'}`}
            className="shrink-0 rounded-md p-1 text-resonance-text-muted opacity-0 transition-opacity hover:bg-resonance-bg-hover hover:text-resonance-text-primary group-hover:opacity-100 focus-visible:opacity-100"
          >
            <Copy size={12} aria-hidden="true" />
          </button>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        aria-label="Output"
        className={`!w-2.5 !h-2.5 !bg-resonance-bg-elevated !border-2 !rounded-full transition-opacity ${isSelected ? '!border-resonance-accent opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        style={{ borderColor: isSelected ? undefined : color }}
      />
    </div>
  )
})
