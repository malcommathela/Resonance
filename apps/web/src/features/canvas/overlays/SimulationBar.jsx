import React from 'react'
import { Loader2, CheckCircle2, AlertOctagon } from 'lucide-react'
import { useCanvasStore } from '@/stores/canvasStore'

// Slim bottom execution bar (Phase 10). One status line + one action.
// Detail lives in SimulationOverlay / BottomPanel / report — this bar only
// answers "what's happening" and offers Stop / Retry / View report.
export function SimulationBar({ onStop, onRetry, onViewReport }) {
  const status = useCanvasStore((s) => s.simulationStatus)
  const running = useCanvasStore((s) => s.simulationRunning)
  const error = useCanvasStore((s) => s.simulationErrorMessage)
  const progress = useCanvasStore((s) => s.simulationProgress)

  if (!running && status !== 'completed' && status !== 'failed') return null

  return (
    <div className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-xl border border-resonance-border bg-resonance-bg-elevated/95 px-4 py-2 shadow-2xl backdrop-blur-md">
        {running ? (
          <>
            <Loader2 size={14} className="animate-spin text-resonance-accent" aria-hidden="true" />
            <span className="text-[13px] font-medium text-resonance-text-primary">
              {progress > 0 ? `Simulation running · ${Math.round(progress)}%` : 'Preparing simulation…'}
            </span>
            <button
              onClick={onStop}
              className="rounded-lg bg-resonance-bg-tertiary px-2.5 py-1 text-xs font-medium text-resonance-text-secondary transition-colors hover:bg-resonance-bg-hover hover:text-resonance-text-primary"
            >
              Stop
            </button>
          </>
        ) : status === 'completed' ? (
          <>
            <CheckCircle2 size={14} className="text-resonance-success" aria-hidden="true" />
            <span className="text-[13px] font-medium text-resonance-text-primary">Simulation complete</span>
            <button
              onClick={onViewReport}
              className="rounded-lg bg-resonance-accent px-2.5 py-1 text-xs font-semibold text-resonance-neutral transition-colors hover:bg-resonance-accent-hover"
            >
              View report
            </button>
          </>
        ) : (
          <>
            <AlertOctagon size={14} className="text-resonance-error" aria-hidden="true" />
            <span className="max-w-[280px] truncate text-[13px] font-medium text-resonance-text-primary" title={error || 'Simulation failed'}>
              Simulation failed{error ? ` · ${error}` : ''}
            </span>
            <button
              onClick={onRetry}
              className="rounded-lg bg-resonance-bg-tertiary px-2.5 py-1 text-xs font-medium text-resonance-text-secondary transition-colors hover:bg-resonance-bg-hover hover:text-resonance-text-primary"
            >
              Retry
            </button>
          </>
        )}
      </div>
    </div>
  )
}
