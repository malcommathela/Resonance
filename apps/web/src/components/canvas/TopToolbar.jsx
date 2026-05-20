import React from 'react'
import {
  Save,
  Download,
  Share2,
  GitBranch,
  Undo2,
  Redo2,
  MoreHorizontal,
} from 'lucide-react'
import { SimulationControls } from './SimulationControls'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export const TopToolbar = ({
  designName,
  activeTab,
  onTabChange,
  onSave,
  onExport,
  onShare,
  simulationRunning,
  onRunSimulation,
  simulationProgress,
}) => {
  const tabs = [
    { id: 'editor', label: 'Editor' },
    { id: 'simulation', label: 'Simulation' },
    { id: 'export', label: 'Export' },
  ]

  return (
    <div className="h-12 border-b border-resonance-border bg-resonance-bg-secondary flex items-center justify-between px-4 shrink-0">
      {/* Left: Design info */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <GitBranch size={16} className="text-resonance-accent" />
          <span className="font-semibold text-resonance-text-primary text-sm">{designName}</span>
          <Badge variant="draft">Draft</Badge>
        </div>

        <div className="h-5 w-px bg-resonance-border" />

        {/* Tabs */}
        <div className="flex items-center gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-resonance-accent/10 text-resonance-accent'
                  : 'text-resonance-text-secondary hover:text-resonance-text-primary hover:bg-resonance-bg-hover'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Center: History controls */}
      <div className="flex items-center gap-1">
        <button className="p-1.5 rounded-lg hover:bg-resonance-bg-hover text-resonance-text-muted hover:text-resonance-text-secondary transition-colors">
          <Undo2 size={16} />
        </button>
        <button className="p-1.5 rounded-lg hover:bg-resonance-bg-hover text-resonance-text-muted hover:text-resonance-text-secondary transition-colors">
          <Redo2 size={16} />
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          icon={Save}
          onClick={onSave}
        >
          Save
        </Button>

        <SimulationControls
          onRun={onRunSimulation}
          isRunning={simulationRunning}
          progress={simulationProgress}
        />

        <div className="h-5 w-px bg-resonance-border mx-1" />

        <button
          onClick={onExport}
          className="p-2 rounded-lg hover:bg-resonance-bg-hover text-resonance-text-secondary hover:text-resonance-text-primary transition-colors"
          title="Export"
        >
          <Download size={16} />
        </button>

        <button
          onClick={onShare}
          className="p-2 rounded-lg hover:bg-resonance-bg-hover text-resonance-text-secondary hover:text-resonance-text-primary transition-colors"
          title="Share"
        >
          <Share2 size={16} />
        </button>

        <button className="p-2 rounded-lg hover:bg-resonance-bg-hover text-resonance-text-secondary hover:text-resonance-text-primary transition-colors">
          <MoreHorizontal size={16} />
        </button>
      </div>
    </div>
  )
}
