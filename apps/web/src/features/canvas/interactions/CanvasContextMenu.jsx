import React, { useEffect, useRef } from 'react'
import { useCanvasStore } from '@/stores/canvasStore'
import { canvasCommands, hasClipboard } from '../core/canvasCommands'
import { getFlowInstance } from '../core/flowInstance'

// Canvas context menus (Phase 7). One component, three levels (node/edge/pane).
// Every action routes through canvasCommands — the same fns keyboard and
// buttons use. Group/create-note items arrive with Phase 8.
export function CanvasContextMenu({ menu, onClose, onConfigure }) {
  const ref = useRef(null)
  // ponytail: no Ctrl+G shortcut — it collides with browser find-next; menu only
  const selectedCount = useCanvasStore((s) => s.selectedNodeIds.length)
  const memberOfGroupId = useCanvasStore((s) => menu?.kind === 'node'
    ? (s.nodes.find((n) => n.type === 'group' && (n.data?.nodeIds || []).includes(menu.id))?.id || null)
    : null)

  useEffect(() => {
    if (!menu) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    ref.current?.querySelector('button')?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [menu, onClose])

  if (!menu) return null

  const items = []
  if (menu.kind === 'node') {
    items.push(
      { label: 'Add connected node', run: () => canvasCommands.openNodePicker(menu.id) },
      { label: 'Configure', run: () => onConfigure('node', menu.id) },
      { label: 'Duplicate', run: () => canvasCommands.duplicateNode(menu.id) },
      ...(memberOfGroupId ? [{ label: 'Remove from group', run: () => canvasCommands.removeGroupMember(memberOfGroupId, menu.id) }] : []),
      { label: 'Copy', run: () => { void canvasCommands.copySelection() } },
      { label: 'Focus', run: () => canvasCommands.focusSelection() },
      { label: 'Delete', danger: true, run: () => canvasCommands.deleteSelection() },
    )
  } else if (menu.kind === 'group') {
    items.push(
      { label: 'Focus', run: () => canvasCommands.focusSelection() },
      { label: 'Ungroup', run: () => canvasCommands.ungroup(menu.id) },
      { label: 'Delete group', danger: true, run: () => canvasCommands.deleteSelection() },
    )
  } else if (menu.kind === 'edge') {
    items.push(
      { label: 'Configure', run: () => onConfigure('edge', menu.id) },
      { label: 'Delete', danger: true, run: () => canvasCommands.deleteSelection() },
    )
  } else {
    items.push(
      { label: 'Add component', run: () => canvasCommands.openNodePicker() },
      {
        label: 'Add group', run: () => {
          const inst = getFlowInstance()
          canvasCommands.createEmptyGroup(inst ? inst.screenToFlowPosition({ x: menu.x, y: menu.y }) : { x: 0, y: 0 })
        },
      },
      ...(selectedCount >= 2 ? [{ label: `Create group (${selectedCount})`, run: () => canvasCommands.createGroup() }] : []),
      ...(hasClipboard() ? [{ label: 'Paste', run: () => {
        const inst = getFlowInstance()
        canvasCommands.pasteClipboard(inst ? inst.screenToFlowPosition({ x: menu.x, y: menu.y }) : undefined)
      } }] : []),
      { label: 'Select all', run: () => canvasCommands.selectAll() },
      { label: 'Fit architecture', run: () => canvasCommands.fitArchitecture() },
    )
  }

  const x = Math.min(menu.x, window.innerWidth - 210)
  const y = Math.min(menu.y, window.innerHeight - items.length * 36 - 16)

  return (
    <>
      <button aria-hidden="true" tabIndex={-1} className="fixed inset-0 z-[60] cursor-default" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose() }} />
      <div
        ref={ref}
        role="menu"
        className="fixed z-[61] w-[200px] rounded-xl border border-resonance-border bg-resonance-bg-elevated py-1 shadow-2xl"
        style={{ left: x, top: y }}
      >
        {items.map((item) => (
          <button
            key={item.label}
            role="menuitem"
            onClick={() => { item.run(); onClose() }}
            className={`flex w-full items-center px-3 py-2 text-left text-[13px] transition-colors ${
              item.danger
                ? 'text-resonance-error hover:bg-resonance-error/10'
                : 'text-resonance-text-secondary hover:bg-resonance-bg-hover hover:text-resonance-text-primary'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  )
}
