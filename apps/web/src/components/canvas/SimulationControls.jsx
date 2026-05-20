import React, { useState } from 'react'
import {
  Play,
  Pause,
  Settings2,
  TrendingUp,
  Activity,
  Zap,
  Timer,
} from 'lucide-react'
import { useCanvasStore } from '@/stores/canvasStore'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

export const SimulationControls = ({ onRun, isRunning, progress }) => {
  const [showSettings, setShowSettings] = useState(false)
  const [trafficPattern, setTrafficPattern] = useState('steady')
  const [rps, setRps] = useState(100)
  const [duration, setDuration] = useState(300)

  const patterns = [
    { id: 'steady', label: 'Steady', icon: TrendingUp, desc: 'Constant request rate' },
    { id: 'spike', label: 'Spike', icon: Zap, desc: 'Sudden traffic spike', disabled: true },
    { id: 'ramp', label: 'Ramp', icon: Activity, desc: 'Gradual increase', disabled: true },
  ]

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant={isRunning ? 'danger' : 'primary'}
          size="sm"
          icon={isRunning ? Pause : Play}
          onClick={onRun}
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
            <div className="grid grid-cols-3 gap-3">
              {patterns.map(pattern => {
                const Icon = pattern.icon
                const isActive = trafficPattern === pattern.id
                return (
                  <button
                    key={pattern.id}
                    onClick={() => !pattern.disabled && setTrafficPattern(pattern.id)}
                    disabled={pattern.disabled}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      isActive
                        ? 'border-resonance-accent bg-resonance-accent/5'
                        : pattern.disabled
                        ? 'border-resonance-border opacity-50 cursor-not-allowed'
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
