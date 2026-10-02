import React, { useEffect } from 'react'

// Shared floating inspector slot (Phases 6/9/10). One overlay, never a grid
// column — canvas never resizes. Compact card, content-height up to 600px.
// ponytail: fixed-docked, not node-anchored; anchor to node + flip when needed.
export function InspectorShell({ onClose, children, label = 'Inspector' }) {
  // Close returns focus to the canvas so shortcuts work immediately (Phase 17).
  const close = () => {
    onClose()
    requestAnimationFrame(() => document.querySelector('[data-canvas-container]')?.focus())
  }
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-label={label}
      className="absolute right-4 top-4 z-40 flex max-h-[600px] w-[360px] max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-xl border border-resonance-border bg-resonance-bg-panel shadow-2xl motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-2 motion-safe:duration-180"
    >
      {children}
    </div>
  )
}
