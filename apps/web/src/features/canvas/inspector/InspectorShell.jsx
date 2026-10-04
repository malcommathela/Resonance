import React, { useEffect } from 'react'

// Shared floating inspector slot: viewport-centered dialog (Modal convention,
// no backdrop so the canvas stays interactive). One shell owns width/height;
// children must not impose their own max-h — scroll regions use flex-1 + min-h-0.
// NOTE: bg-resonance-panel-bg (not bg-resonance-bg-panel) is the real theme
// class; the swapped name emits no CSS and renders transparent.
// Distinct compact tokens (both live call sites use sm). Single width per
// token — no w-full alongside, so generated-CSS order can't flip the result.
// max-w keeps narrow viewports safe; max-h caps tall viewports so long
// content scrolls inside instead of filling the screen.
const SIZES = {
  sm: 'w-[427px]',
  md: 'w-[400px]',
  lg: 'w-[520px]',
}

export function InspectorShell({ onClose, children, label = 'Inspector', size = 'md' }) {
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
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="false"
        aria-label={label}
        className={`pointer-events-auto flex max-h-[min(36rem,calc(100dvh-6rem))] ${SIZES[size] || SIZES.md} max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-resonance-border bg-resonance-panel-bg shadow-2xl animate-scale-in`}
      >
        {children}
      </div>
    </div>
  )
}
