import React, { useEffect, useRef, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useCanvasStore } from '@/stores/canvasStore'
import { blockIconMap } from '@/lib/iconMap'
import { Activity, AlertTriangle } from 'lucide-react'

export const CustomBlockNode = ({ data, selected, id }) => {
  // FIX: Use data.icon (e.g. 'Server', 'Globe') not data.type (e.g. 'service', 'api-gateway')
  const IconComponent = blockIconMap[data.icon] || blockIconMap['Server']
  const color = data.color || '#8b5cf6'
  const nodeRef = useRef(null)
  const [pulseState, setPulseState] = useState('idle')
  const { simulationRunning } = useCanvasStore()

  useEffect(() => {
    if (!simulationRunning || !data.metrics) {
      setPulseState('idle')
      return
    }
    const { errors, latency, rps } = data.metrics
    if (errors > 20) setPulseState('error')
    else if (latency > 200) setPulseState('warning')
    else if (rps > 0) setPulseState('processing')
    else setPulseState('idle')
  }, [simulationRunning, data.metrics])

  const getPulseStyles = () => {
    switch (pulseState) {
      case 'processing':
        return {
          boxShadow: `0 0 0 0 ${color}40, 0 0 20px ${color}30`,
          animation: 'node-pulse-processing 1.5s ease-in-out infinite',
        }
      case 'warning':
        return {
          boxShadow: `0 0 0 0 #f59e0b40, 0 0 20px #f59e0b30`,
          animation: 'node-pulse-warning 1s ease-in-out infinite',
        }
      case 'error':
        return {
          boxShadow: `0 0 0 0 #ef444440, 0 0 20px #ef444430`,
          animation: 'node-pulse-error 0.7s ease-in-out infinite',
        }
      default:
        return {}
    }
  }

  const getStatusIcon = () => {
    switch (pulseState) {
      case 'processing':
        return <Activity size={12} className="text-green-400 animate-pulse" />
      case 'warning':
        return <AlertTriangle size={12} className="text-amber-400" />
      case 'error':
        return <AlertTriangle size={12} className="text-red-400" />
      default:
        return null
    }
  }

  return (
    <div
      ref={nodeRef}
      className={`relative group min-w-[180px] transition-all duration-300 ${
        selected ? 'ring-2 ring-resonance-accent ring-offset-2 ring-offset-resonance-canvas-bg' : ''
      }`}
    >
      <Handle 
        type="target" 
        position={Position.Top} 
        className="!w-3 !h-3 !bg-resonance-accent !border-2 !border-resonance-canvas-bg !rounded-full"
      />

      <div 
        className="bg-resonance-bg-elevated border border-resonance-border rounded-xl p-3 shadow-lg hover:shadow-xl transition-all duration-200"
        style={{ 
          borderLeft: `3px solid ${color}`,
          ...getPulseStyles(),
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${color}15` }}
          >
            <IconComponent size={16} style={{ color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-resonance-text-primary truncate">
                {data.label}
              </p>
              {getStatusIcon()}
            </div>
            <p className="text-xs text-resonance-text-muted capitalize">
              {data.type.replace(/-/g, ' ')}
            </p>
          </div>
        </div>

        {simulationRunning && data.metrics && (
          <div className="mt-2 pt-2 border-t border-resonance-border space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-resonance-text-muted uppercase tracking-wider">RPS</span>
              <span className="text-xs font-mono font-medium text-resonance-text-primary">
                {data.metrics.rps?.toLocaleString() || 0}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-resonance-text-muted uppercase tracking-wider w-10">Latency</span>
              <div className="flex-1 h-1.5 bg-resonance-bg-tertiary rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min((data.metrics.latency || 0) / 5, 100)}%`,
                    backgroundColor: (data.metrics.latency || 0) > 200 ? '#ef4444' : 
                                      (data.metrics.latency || 0) > 100 ? '#f59e0b' : '#10b981',
                  }}
                />
              </div>
              <span className="text-[10px] font-mono text-resonance-text-secondary w-10 text-right">
                {data.metrics.latency || 0}ms
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[10px] text-resonance-text-muted uppercase tracking-wider">Errors</span>
              <span className={`text-xs font-mono font-medium ${
                (data.metrics.errors || 0) > 10 ? 'text-red-400' : 'text-green-400'
              }`}>
                {data.metrics.errors || 0}
              </span>
            </div>

            {data.metrics.utilization !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-resonance-text-muted uppercase tracking-wider w-10">Load</span>
                <div className="flex-1 h-1 bg-resonance-bg-tertiary rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(data.metrics.utilization || 0) * 100}%`,
                      backgroundColor: data.metrics.utilization > 0.85 ? '#ef4444' : 
                                        data.metrics.utilization > 0.7 ? '#f59e0b' : '#10b981',
                    }}
                  />
                </div>
                <span className="text-[10px] font-mono text-resonance-text-secondary w-10 text-right">
                  {((data.metrics.utilization || 0) * 100).toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        )}

        {data.config && !simulationRunning && (
          <div className="mt-2 flex flex-wrap gap-1">
            {data.config.replicas && (
              <span className="px-1.5 py-0.5 rounded bg-resonance-bg-tertiary text-[10px] text-resonance-text-muted">
                {data.config.replicas}×
              </span>
            )}
            {data.config.port && (
              <span className="px-1.5 py-0.5 rounded bg-resonance-bg-tertiary text-[10px] text-resonance-text-muted">
                :{data.config.port}
              </span>
            )}
            {data.config.engine && (
              <span className="px-1.5 py-0.5 rounded bg-resonance-bg-tertiary text-[10px] text-resonance-text-muted capitalize">
                {data.config.engine}
              </span>
            )}
          </div>
        )}
      </div>

      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="!w-3 !h-3 !bg-resonance-accent !border-2 !border-resonance-canvas-bg !rounded-full"
      />

      <style>{`
        @keyframes node-pulse-processing {
          0%, 100% { box-shadow: 0 0 0 0 ${color}40, 0 0 20px ${color}20; }
          50% { box-shadow: 0 0 0 8px ${color}00, 0 0 30px ${color}40; }
        }
        @keyframes node-pulse-warning {
          0%, 100% { box-shadow: 0 0 0 0 #f59e0b40, 0 0 20px #f59e0b20; }
          50% { box-shadow: 0 0 0 8px #f59e0b00, 0 0 30px #f59e0b40; }
        }
        @keyframes node-pulse-error {
          0%, 100% { box-shadow: 0 0 0 0 #ef444440, 0 0 20px #ef444430; }
          50% { box-shadow: 0 0 0 10px #ef444400, 0 0 40px #ef444450; }
        }
      `}</style>
    </div>
  )
}