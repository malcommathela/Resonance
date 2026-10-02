import React, { useEffect } from 'react'

// Shared floating inspector slot. Two placements: validation is a
// viewport-centered dialog (Modal convention, no backdrop so the canvas
// stays interactive); properties is a slim right-docked card. One shell
// owns width/height; children must not impose their own max-h — scroll
// regions use flex-1 + min-h-0.
// NOTE: bg-resonance-panel-bg (not bg-resonance-bg-panel) is the real theme
// class; the swapped name emits no CSS and renders transparent.
const SIZES = {
  sm: 'w-[320px]',
  md: 'w-[360px]',
  lg: 'w-[520px]',
}

export function InspectorShell({ onClose, children, label = 'Inspector', size = 'md', placement = 'center' }) {
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

  const right = placement === 'right'
  return (
    <div className={`pointer-events-none fixed inset-0 z-50 flex p-4 ${right ? 'justify-end' : 'items-center justify-center'}`}>
      <div
        role="dialog"
        aria-modal="false"
        aria-label={label}
        className={`pointer-events-auto flex ${right ? 'h-full' : 'max-h-[calc(100dvh-6rem)]'} ${SIZES[size] || SIZES.md} w-full max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-resonance-border bg-resonance-panel-bg shadow-2xl animate-scale-in`}
      >
        {children}
      </div>
    </div>
  )
}
