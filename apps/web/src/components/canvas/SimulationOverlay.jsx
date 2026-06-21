import React from 'react'
import { Loader2, Activity, AlertTriangle, Zap } from 'lucide-react'
import { useCanvasStore } from '@/stores/canvasStore'

export const SimulationOverlay = ({ progress }) => {
  const { simulationMetrics } = useCanvasStore()

  return (
    <div className="absolute top-10 left-1/2 -translate-x-1/2 z-40 pointer-events-auto">
      <div className="flex items-center gap-4 px-5 py-2.5 rounded-xl bg-resonance-bg-elevated/95 backdrop-blur-md border border-resonance-border shadow-2xl">
        {/* Spinner + Status */}
        <div className="flex items-center gap-2.5">
          <Loader2 size={16} className="animate-spin text-resonance-accent" />
          <span className="text-sm font-semibold text-resonance-text-primary">
            Simulation Running
          </span>
        </div>

        {/* Progress % */}
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 bg-resonance-bg-tertiary rounded-full overflow-hidden">
            <div
              className="h-full bg-resonance-accent rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs font-mono font-medium text-resonance-text-secondary w-8">
            {Math.round(progress)}%
          </span>
        </div>

        {/* Mini metrics */}
        <div className="flex items-center gap-3 border-l border-resonance-border pl-3">
          {simulationMetrics && (
            <>
              <div className="flex items-center gap-1" title="Throughput">
                <Zap size={12} className="text-green-400" />
                <span className="text-[11px] font-mono text-resonance-text-secondary">
                  {Math.round(simulationMetrics.throughput || 0)}
                </span>
              </div>
              <div className="flex items-center gap-1" title="Error Rate">
                <AlertTriangle size={12} className={
                  parseFloat(simulationMetrics.errorRate || 0) > 1 ? 'text-red-400' : 'text-green-400'
                } />
                <span className="text-[11px] font-mono text-resonance-text-secondary">
                  {simulationMetrics.errorRate || '0.00'}%
                </span>
              </div>
              <div className="flex items-center gap-1" title="Avg Latency">
                <Activity size={12} className="text-blue-400" />
                <span className="text-[11px] font-mono text-resonance-text-secondary">
                  {Math.round(simulationMetrics.avgLatency || 0)}ms
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}