import React, { useState, useEffect, useRef } from 'react'
import {
  Play,
  Pause,
  Settings2,
  TrendingUp,
  Activity,
  Zap,
  Timer,
  AlertTriangle,
  Database,
  CloudOff,
  ShieldAlert,
  Waves,
} from 'lucide-react'
import { useCanvasStore } from '@/stores/canvasStore'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

const TRAFFIC_PATTERNS = [
  { id: 'steady', label: 'Steady', icon: TrendingUp, desc: 'Constant request rate' },
  { id: 'spike', label: 'Spike', icon: Zap, desc: '50x traffic spike at 60%' },
  { id: 'ramp', label: 'Ramp', icon: Activity, desc: 'Linear increase to 10x' },
  { id: 'chaos', label: 'Chaos', icon: Waves, desc: 'Random traffic spikes' },
]

const SCENARIOS = [
  { id: 'none', label: 'None', icon: TrendingUp, desc: 'Normal operation' },
  { id: 'db_slowdown', label: 'DB Slowdown', icon: Database, desc: 'Database slows 70% at 40%' },
  { id: 'cache_eviction', label: 'Cache Eviction', icon: Zap, desc: 'Cache fails at 50%' },
  { id: 'region_outage', label: 'Region Outage', icon: CloudOff, desc: 'Random block fails at 30%' },
  { id: 'ddos', label: 'DDoS', icon: ShieldAlert, desc: 'Gateway overwhelmed from start' },
]

export const SimulationControls = ({ onRun, isRunning, progress, metrics, simulationId }) => {
  const [showSettings, setShowSettings] = useState(false)
  const [trafficPattern, setTrafficPattern] = useState('steady')
  const [scenario, setScenario] = useState('none')
  const [rps, setRps] = useState(100)
  const [duration, setDuration] = useState(300)
  const [liveMetrics, setLiveMetrics] = useState(null)
  const eventSourceRef = useRef(null)

  // Stream live metrics via SSE
  useEffect(() => {
    if (isRunning && simulationId) {
      const es = new EventSource(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/simulations/${simulationId}/stream`,
        { withCredentials: true }
      )

      es.onmessage = (event) => {
        const data = JSON.parse(event.data)
        setLiveMetrics(data)
      }

      es.onerror = () => {
        es.close()
      }

      eventSourceRef.current = es

      return () => {
        es.close()
      }
    } else {
      setLiveMetrics(null)
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [isRunning, simulationId])

  const handleRun = () => {
    onRun({ trafficPattern, scenario, rps, duration })
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant={isRunning ? 'danger' : 'primary'}
          size="sm"
          icon={isRunning ? Pause : Play}
          onClick={handleRun}
        >
          {isRunning ? 'Stop' : 'Run'}
        </Button>

        <button
          onClick={() => setShowSettings(true)}
          className="p-2 rounded-lg hover:bg-resonance-bg-hover text-resonance-text-secondary hover:text-resonance-text-primary transition-colors"
          title="Simulation Settings"
        >
          <Settings2 size={16} />
        </button>
      </div>

      {/* Live Metrics Mini-Panel */}
      {isRunning && liveMetrics && (
        <div className="absolute top-14 right-4 z-20 w-72 bg-resonance-bg-elevated border border-resonance-border rounded-xl shadow-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-resonance-text-secondary uppercase tracking-wider">Live Metrics</span>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-green-500">{liveMetrics.progress?.toFixed(0)}%</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-resonance-bg-tertiary rounded-lg p-2">
              <p className="text-xs text-resonance-text-muted">RPS</p>
              <p className="text-sm font-semibold text-resonance-text-primary">{liveMetrics.currentRps?.toFixed(0)}</p>
            </div>
            <div className="bg-resonance-bg-tertiary rounded-lg p-2">
              <p className="text-xs text-resonance-text-muted">Latency</p>
              <p className="text-sm font-semibold text-resonance-text-primary">{liveMetrics.global?.avgLatency?.toFixed(1)}ms</p>
            </div>
            <div className="bg-resonance-bg-tertiary rounded-lg p-2">
              <p className="text-xs text-resonance-text-muted">Errors</p>
              <p className="text-sm font-semibold text-red-400">{liveMetrics.global?.totalErrors || 0}</p>
            </div>
            <div className="bg-resonance-bg-tertiary rounded-lg p-2">
              <p className="text-xs text-resonance-text-muted">Dropped</p>
              <p className="text-sm font-semibold text-amber-400">{liveMetrics.global?.totalDropped || 0}</p>
            </div>
          </div>

          {/* Per-block utilization */}
          <div className="space-y-1 max-h-[120px] overflow-y-auto">
            {liveMetrics.metrics && Object.entries(liveMetrics.metrics).slice(0, 5).map(([blockId, blockMetrics]) => (
              <div key={blockId} className="flex items-center gap-2 text-xs">
                <div className="w-16 truncate text-resonance-text-muted">{blockId.slice(0, 8)}</div>
                <div className="flex-1 h-1.5 bg-resonance-bg-tertiary rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      blockMetrics.utilization > 0.9 ? 'bg-red-500' :
                      blockMetrics.utilization > 0.7 ? 'bg-amber-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(blockMetrics.utilization * 100, 100)}%` }}
                  />
                </div>
                <span className="w-8 text-right text-resonance-text-secondary">{(blockMetrics.utilization * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        title="Simulation Settings"
        size="md"
      >
        <div className="space-y-6">
          {/* Traffic Pattern */}
          <div>
            <label className="block text-sm font-medium text-resonance-text-secondary mb-3">
              Traffic Pattern
            </label>
            <div className="grid grid-cols-2 gap-3">
              {TRAFFIC_PATTERNS.map(pattern => {
                const Icon = pattern.icon
                const isActive = trafficPattern === pattern.id
                return (
                  <button
                    key={pattern.id}
                    onClick={() => setTrafficPattern(pattern.id)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      isActive
                        ? 'border-resonance-accent bg-resonance-accent/5'
                        : 'border-resonance-border hover:border-resonance-accent/30'
                    }`}
                  >
                    <Icon size={20} className={`mx-auto mb-2 ${isActive ? 'text-resonance-accent' : 'text-resonance-text-muted'}`} />
                    <p className={`text-sm font-medium ${isActive ? 'text-resonance-accent' : 'text-resonance-text-primary'}`}>
                      {pattern.label}
                    </p>
                    <p className="text-xs text-resonance-text-muted mt-1">{pattern.desc}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Failure Scenario */}
          <div>
            <label className="block text-sm font-medium text-resonance-text-secondary mb-3">
              Failure Scenario
            </label>
            <div className="grid grid-cols-3 gap-2">
              {SCENARIOS.map(sc => {
                const Icon = sc.icon
                const isActive = scenario === sc.id
                return (
                  <button
                    key={sc.id}
                    onClick={() => setScenario(sc.id)}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      isActive
                        ? 'border-red-500/50 bg-red-500/5'
                        : 'border-resonance-border hover:border-red-500/20'
                    }`}
                  >
                    <Icon size={16} className={`mx-auto mb-1.5 ${isActive ? 'text-red-400' : 'text-resonance-text-muted'}`} />
                    <p className={`text-xs font-medium ${isActive ? 'text-red-400' : 'text-resonance-text-primary'}`}>
                      {sc.label}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* RPS Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-resonance-text-secondary">Requests Per Second</label>
              <span className="text-sm font-mono text-resonance-accent">{rps} RPS</span>
            </div>
            <input
              type="range"
              min="10"
              max="10000"
              step="10"
              value={rps}
              onChange={(e) => setRps(parseInt(e.target.value))}
              className="w-full h-2 bg-resonance-bg-tertiary rounded-lg appearance-none cursor-pointer accent-resonance-accent"
            />
            <div className="flex justify-between text-xs text-resonance-text-muted mt-1">
              <span>10</span>
              <span>5,000</span>
              <span>10,000</span>
            </div>
          </div>

          {/* Duration */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-resonance-text-secondary">Duration</label>
              <span className="text-sm font-mono text-resonance-accent">{duration}s</span>
            </div>
            <input
              type="range"
              min="30"
              max="1800"
              step="30"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              className="w-full h-2 bg-resonance-bg-tertiary rounded-lg appearance-none cursor-pointer accent-resonance-accent"
            />
            <div className="flex justify-between text-xs text-resonance-text-muted mt-1">
              <span>30s</span>
              <span>15m</span>
              <span>30m</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowSettings(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowSettings(false)}>
              Apply Settings
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
