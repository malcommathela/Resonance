import React, { useEffect, useRef } from 'react'
import { Play, Loader2, Activity } from 'lucide-react'
import { animations } from '@/lib/anime'

export const SimulationOverlay = ({ progress }) => {
  const overlayRef = useRef(null)
  const progressRef = useRef(null)

  useEffect(() => {
    if (overlayRef.current) {
      animations.fadeIn(overlayRef.current, 0)
    }
  }, [])

  useEffect(() => {
    if (progressRef.current) {
      animations.countUp(progressRef.current, 0, progress, 300)
    }
  }, [progress])

  return (
    <div
      ref={overlayRef}
      className="absolute top-4 left-1/2 -translate-x-1/2 z-50"
      style={{ opacity: 0 }}
    >
      <div className="glass-panel rounded-xl px-6 py-3 flex items-center gap-4 shadow-2xl">
        <div className="relative">
          <div className="w-8 h-8 rounded-full border-2 border-resonance-accent/30 flex items-center justify-center">
            <Loader2 size={16} className="text-resonance-accent animate-spin" />
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-resonance-text-primary">Simulation Running</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-32 h-1.5 bg-resonance-bg-tertiary rounded-full overflow-hidden">
              <div
                className="h-full bg-resonance-accent rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span ref={progressRef} className="text-xs text-resonance-text-muted font-mono">
              {progress}%
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-resonance-text-muted">
          <Activity size={12} />
          <span>Steady traffic</span>
        </div>
      </div>
    </div>
  )
}
