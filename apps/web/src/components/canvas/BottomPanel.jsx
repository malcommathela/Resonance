import React, { useState, useRef, useEffect } from 'react'
import {
  Terminal,
  BarChart3,
  ChevronUp,
  ChevronDown,
  X,
  Info,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { useCanvasStore } from '@/stores/canvasStore'
import { animations } from '@/lib/anime'

export const BottomPanel = ({ logs }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('logs')
  const [height, setHeight] = useState(200)
  const panelRef = useRef(null)
  const logsEndRef = useRef(null)

  const { simulationMetrics } = useCanvasStore()

  useEffect(() => {
    if (logsEndRef.current && isOpen) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, isOpen])

  const tabs = [
    { id: 'logs', label: 'Console', icon: Terminal },
    { id: 'metrics', label: 'Metrics', icon: BarChart3 },
  ]

  const getLogIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle2 size={14} className="text-green-500" />
      case 'warning': return <AlertTriangle size={14} className="text-amber-500" />
      case 'error': return <X size={14} className="text-red-500" />
      default: return <Info size={14} className="text-blue-500" />
    }
  }

  return (
    <div
      className="border-t border-resonance-border bg-resonance-bg-secondary shrink-0 transition-all duration-300"
      style={{ height: isOpen ? height : 36 }}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-4 h-9 border-b border-resonance-border cursor-pointer hover:bg-resonance-bg-hover transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-4">
          {tabs.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveTab(tab.id)
                  if (!isOpen) setIsOpen(true)
                }}
                className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-resonance-accent'
                    : 'text-resonance-text-muted hover:text-resonance-text-secondary'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-2">
          {isOpen && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsOpen(false)
              }}
              className="p-0.5 rounded hover:bg-resonance-bg-hover transition-colors"
            >
              <X size={14} className="text-resonance-text-muted" />
            </button>
          )}
          {isOpen ? (
            <ChevronDown size={14} className="text-resonance-text-muted" />
          ) : (
            <ChevronUp size={14} className="text-resonance-text-muted" />
          )}
        </div>
      </div>

      {/* Content */}
      {isOpen && (
        <div ref={panelRef} className="h-full overflow-hidden">
          {activeTab === 'logs' && (
            <div className="h-full overflow-y-auto p-3 space-y-1 font-mono text-xs">
              {logs.length === 0 ? (
                <p className="text-resonance-text-muted text-center py-8">No logs yet. Run a simulation to see output.</p>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2 py-0.5">
                    {getLogIcon(log.type)}
                    <span className="text-resonance-text-muted shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="text-resonance-text-secondary">{log.message}</span>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          )}

          {activeTab === 'metrics' && (
            <div className="h-full overflow-y-auto p-4">
              {!simulationMetrics ? (
                <p className="text-resonance-text-muted text-center py-8">Run a simulation to see metrics.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <MetricCard
                    label="Total Requests"
                    value={simulationMetrics.totalRequests.toLocaleString()}
                    icon={BarChart3}
                  />
                  <MetricCard
                    label="Avg Latency"
                    value={`${simulationMetrics.avgLatency}ms`}
                    icon={Clock}
                  />
                  <MetricCard
                    label="P99 Latency"
                    value={`${simulationMetrics.p99Latency}ms`}
                    icon={Clock}
                  />
                  <MetricCard
                    label="Error Rate"
                    value={`${simulationMetrics.errorRate}%`}
                    icon={AlertTriangle}
                    warning={parseFloat(simulationMetrics.errorRate) > 1}
                  />
                  <MetricCard
                    label="Throughput"
                    value={`${simulationMetrics.throughput} RPS`}
                    icon={BarChart3}
                  />
                  <MetricCard
                    label="Availability"
                    value={`${simulationMetrics.availability}%`}
                    icon={CheckCircle2}
                    success
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const MetricCard = ({ label, value, icon: Icon, warning, success }) => (
  <div className="p-3 rounded-lg bg-resonance-bg-tertiary border border-resonance-border">
    <div className="flex items-center gap-2 mb-2">
      <Icon size={14} className={`${
        warning ? 'text-amber-500' : success ? 'text-green-500' : 'text-resonance-accent'
      }`} />
      <span className="text-xs text-resonance-text-muted">{label}</span>
    </div>
    <p className={`text-lg font-bold ${
      warning ? 'text-amber-500' : success ? 'text-green-500' : 'text-resonance-text-primary'
    }`}>
      {value}
    </p>
  </div>
)
