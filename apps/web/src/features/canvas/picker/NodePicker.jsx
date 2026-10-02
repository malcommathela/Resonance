import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Group as GroupIcon } from 'lucide-react'
import { categories } from '@shared/constants'
import { libraryIconMap } from '@/lib/iconMap'
import { useCanvasStore } from '@/stores/canvasStore'
import { canvasCommands } from '../core/canvasCommands'
import { getFlowInstance } from '../core/flowInstance'

const RECENT_KEY = 'resonance.picker.recent'
const RECENT_MAX = 5

function readRecent() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY))
    return Array.isArray(raw) ? raw.filter((t) => typeof t === 'string') : []
  } catch {
    return []
  }
}

function recordRecent(type) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([type, ...readRecent().filter((t) => t !== type)].slice(0, RECENT_MAX)))
  } catch { /* private mode — recent is best-effort */ }
}

// Contextual node picker (Phase 5). One component for every entry point:
// node +, global +, keyboard (N), canvas menu, empty canvas.
// Block data comes from the existing definitions via getAllBlockTypes()
// (custom types included); drag reuses the library drop path.
export function NodePicker() {
  const request = useCanvasStore((s) => s.nodePicker)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const allTypes = useCanvasStore((s) => s.customBlockTypes) // subscribe: custom types land here
  const getAllBlockTypes = useCanvasStore((s) => s.getAllBlockTypes)
  const blocks = useMemo(() => getAllBlockTypes(), [getAllBlockTypes, allTypes])
  const nodes = useCanvasStore((s) => s.nodes)

  const source = request?.sourceId ? nodes.find((n) => n.id === request.sourceId) : null

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    return blocks.filter((b) => {
      if (category !== 'all' && b.category !== category) return false
      if (!q) return true
      return b.label.toLowerCase().includes(q)
        || b.id.toLowerCase().includes(q)
        || (b.category || '').toLowerCase().includes(q)
    })
  }, [blocks, query, category])

  const recent = useMemo(() => {
    if (query || category !== 'all') return []
    const byId = new Map(blocks.map((b) => [b.id, b]))
    return readRecent().map((id) => byId.get(id)).filter(Boolean)
  }, [blocks, query, category])

  useEffect(() => {
    if (request) {
      setQuery('')
      setCategory('all')
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [request])

  useEffect(() => { setActive(0) }, [query, category])

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!request) return null

  const visible = recent.length > 0
    ? [{ header: 'Recent' }, ...recent.map((b) => ({ block: b })), { header: 'All blocks' }, ...matches.map((b) => ({ block: b }))]
    : matches.map((b) => ({ block: b }))
  const pickable = visible.filter((r) => r.block)

  const pick = (type) => {
    recordRecent(type)
    if (request.sourceId) {
      const src = nodes.find((n) => n.id === request.sourceId)
      // ponytail: naive right-offset; collision-aware placement when auto-layout lands
      const at = src ? { x: src.position.x + 260, y: src.position.y } : { x: 0, y: 0 }
      canvasCommands.addConnectedNode(type, at, request.sourceId)
    } else {
      const inst = getFlowInstance()
      const at = inst
        ? inst.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
        : { x: 0, y: 0 }
      const node = canvasCommands.addNode(type, at)
      canvasCommands.select(node.id)
    }
    canvasCommands.closeNodePicker()
  }

  const onDragStart = (e, id) => {
    e.dataTransfer.setData('application/resonance-block', id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, pickable.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); const row = pickable[active]; if (row) pick(row.block.id) }
    else if (e.key === 'Escape') { e.preventDefault(); canvasCommands.closeNodePicker() }
  }

  let rowIndex = -1

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/50 px-4 pt-[12vh]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) canvasCommands.closeNodePicker() }}
      role="dialog"
      aria-modal="true"
      aria-label={source ? `Add after ${source.data?.label || 'block'}` : 'Add component'}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-resonance-border bg-resonance-bg-elevated shadow-2xl">
        <div className="border-b border-resonance-border px-4 pb-2 pt-3">
          <p className="mb-2 text-xs font-medium text-resonance-text-muted">
            {source ? <>Add after <span className="text-resonance-text-primary">{source.data?.label || 'block'}</span> — connects automatically</> : 'Add component'}
          </p>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-resonance-text-muted" aria-hidden="true" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search blocks..."
              aria-label="Search blocks"
              className="w-full rounded-lg border border-resonance-border bg-resonance-bg-tertiary py-2 pl-8 pr-3 text-sm text-resonance-text-primary placeholder-resonance-text-muted focus:border-resonance-accent focus:outline-none focus:ring-2 focus:ring-resonance-accent/30"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1" role="tablist" aria-label="Categories">
            {[{ id: 'all', label: 'All' }, ...categories].map((c) => (
              <button
                key={c.id}
                role="tab"
                aria-selected={category === c.id}
                onClick={() => setCategory(c.id)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  category === c.id
                    ? 'bg-resonance-accent text-resonance-neutral'
                    : 'bg-resonance-bg-tertiary text-resonance-text-secondary hover:text-resonance-text-primary'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        {(!query.trim() || 'group'.includes(query.trim().toLowerCase())) && (
          <button
            onClick={() => { canvasCommands.createEmptyGroup(); canvasCommands.closeNodePicker() }}
            className="mx-1.5 mb-1 flex w-[calc(100%-12px)] items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-resonance-bg-hover"
            title="Create an empty background group"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: '#8b5cf615' }}>
              <GroupIcon size={14} style={{ color: '#8b5cf6' }} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-resonance-text-primary">Group</span>
              <span className="block text-[11px] capitalize text-resonance-text-muted">background container</span>
            </span>
          </button>
        )}
        <div ref={listRef} className="max-h-72 overflow-y-auto p-1.5" role="listbox" aria-label="Block types">
          {pickable.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-resonance-text-muted">No blocks match.</p>
          )}
          {visible.map((row, i) => {
            if (row.header) return <p key={`h-${row.header}`} className="px-2.5 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-resonance-text-muted">{row.header}</p>
            rowIndex += 1
            const idx = rowIndex
            const b = row.block
            const Icon = libraryIconMap[b.icon] || libraryIconMap.Server
            return (
              <button
                key={b.id}
                role="option"
                aria-selected={idx === active}
                data-active={idx === active}
                draggable
                onDragStart={(e) => onDragStart(e, b.id)}
                onMouseEnter={() => setActive(idx)}
                onClick={() => pick(b.id)}
                onKeyDown={onKeyDown}
                className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                  idx === active ? 'bg-resonance-bg-hover' : ''
                }`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: `${b.color}15` }}>
                  <Icon size={14} style={{ color: b.color }} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-resonance-text-primary">{b.label}</span>
                  <span className="block text-[11px] capitalize text-resonance-text-muted">{b.category}{b.isCustom ? ' · custom' : ''}</span>
                </span>
              </button>
            )
          })}
        </div>
        <p className="border-t border-resonance-border px-4 py-2 text-[11px] text-resonance-text-muted">
          ↑↓ navigate · Enter add · drag onto canvas · Esc close
        </p>
      </div>
    </div>
  )
}
