import React from 'react'
import {
  Save,
  Download,
  Share2,
  Undo2,
  Redo2,
  ChevronLeft,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCanvasStore } from '@/stores/canvasStore'

export const TopToolbar = ({
  designName,
  activeTab,
  onTabChange,
  onSave,
  onExport,
  onShare,
  extraActions,
  centerContent,
}) => {
  const navigate = useNavigate()
  const { undo, redo, history, historyIndex } = useCanvasStore()

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  return (
    <div className="h-14 bg-resonance-bg-elevated border-b border-resonance-border flex items-center px-4 gap-4 shrink-0">
      {/* LEFT: Navigation + Title + Extra Actions */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          onClick={() => navigate('/dashboard')}
          className="p-1.5 rounded-lg hover:bg-resonance-bg-hover text-resonance-text-secondary hover:text-resonance-text-primary transition-colors"
          title="Back to Dashboard"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="h-6 w-px bg-resonance-border" />

        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-sm font-semibold text-resonance-text-primary truncate">
            {designName}
          </h2>
          {extraActions}
        </div>
      </div>

      {/* CENTER: Tabs + Center Content (SimulationControls) */}
      <div className="flex items-center justify-center gap-4">
        <div className="flex items-center bg-resonance-bg-secondary rounded-lg p-1">
          {['editor', 'simulation', 'metrics'].map(tab => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-all ${
                activeTab === tab
                  ? 'bg-resonance-accent text-white'
                  : 'text-resonance-text-secondary hover:text-resonance-text-primary'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        {centerContent}
      </div>

      {/* RIGHT: Actions */}
      <div className="flex items-center gap-1 flex-1 justify-end">
        {/* History */}
        <button
          onClick={undo}
          disabled={!canUndo}
          className="p-1.5 rounded-lg hover:bg-resonance-bg-hover text-resonance-text-secondary hover:text-resonance-text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Undo (⌘Z)"
        >
          <Undo2 size={16} />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className="p-1.5 rounded-lg hover:bg-resonance-bg-hover text-resonance-text-secondary hover:text-resonance-text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Redo (⌘⇧Z)"
        >
          <Redo2 size={16} />
        </button>

        <div className="h-6 w-px bg-resonance-border mx-1" />

        <button
          onClick={onSave}
          className="p-1.5 rounded-lg hover:bg-resonance-bg-hover text-resonance-text-secondary hover:text-resonance-text-primary transition-colors"
          title="Save (⌘S)"
        >
          <Save size={16} />
        </button>
        <button
          onClick={onExport}
          className="p-1.5 rounded-lg hover:bg-resonance-bg-hover text-resonance-text-secondary hover:text-resonance-text-primary transition-colors"
          title="Export (⌘E)"
        >
          <Download size={16} />
        </button>
        <button
          onClick={onShare}
          className="p-1.5 rounded-lg hover:bg-resonance-bg-hover text-resonance-text-secondary hover:text-resonance-text-primary transition-colors"
          title="Share"
        >
          <Share2 size={16} />
        </button>
      </div>
    </div>
  )
}