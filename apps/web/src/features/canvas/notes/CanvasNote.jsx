import React, { memo, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { canvasCommands } from '../core/canvasCommands'

// Canvas annotation (Phase 8). Free text, draggable, no handles, no simulation
// semantics. Persists per design in localStorage alongside groups.
export const CanvasNote = memo(function CanvasNote({ id, data, selected }) {
  const color = data?.color || '#f59e0b'
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data?.text || '')
  const inputRef = useRef(null)

  useEffect(() => {
    if (!editing) setDraft(data?.text || '')
  }, [data?.text, editing])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const commit = () => {
    if (draft !== (data?.text || '')) canvasCommands.updateNoteText(id, draft)
    setEditing(false)
  }

  return (
    <div
      className={`group relative w-[220px] rounded-xl border bg-resonance-bg-elevated shadow-md ${selected ? 'border-resonance-accent ring-1 ring-resonance-accent' : 'border-resonance-border'}`}
      style={{ borderLeft: `3px solid ${color}` }}
      onDoubleClick={(e) => { e.stopPropagation(); setDraft(data?.text || ''); setEditing(true) }}
      title="Double-click to edit"
    >
      <div className="px-2.5 py-2">
        {editing ? (
          <textarea
            ref={inputRef}
            value={draft}
            rows={3}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Escape') { setDraft(data?.text || ''); setEditing(false) }
            }}
            onClick={(e) => e.stopPropagation()}
            aria-label="Note text"
            data-canvas-input="true"
            placeholder="Write a note..."
            className="nodrag w-full resize-none rounded bg-resonance-bg-tertiary px-1.5 py-1 text-xs leading-relaxed text-resonance-text-primary placeholder-resonance-text-muted focus:outline-none focus:ring-2 focus:ring-resonance-accent/40"
          />
        ) : (
          <p className={`whitespace-pre-wrap text-xs leading-relaxed ${data?.text ? 'text-resonance-text-secondary' : 'text-resonance-text-muted'}`}>
            {data?.text || 'Double-click to edit'}
          </p>
        )}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          canvasCommands.select(id)
          canvasCommands.deleteSelection()
        }}
        title="Delete note"
        aria-label="Delete note"
        className="absolute right-1 top-1 rounded p-0.5 text-resonance-text-muted opacity-0 transition-opacity hover:bg-resonance-bg-hover hover:text-resonance-error group-hover:opacity-100 focus-visible:opacity-100"
      >
        <X size={12} aria-hidden="true" />
      </button>
    </div>
  )
})
