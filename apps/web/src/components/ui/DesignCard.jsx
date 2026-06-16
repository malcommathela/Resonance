import React from 'react'
import { GitBranch, Calendar, Layers } from 'lucide-react'

export const DesignCard = ({ design, viewMode, selected, onSelect, onClick, onDelete }) => {
  if (viewMode === 'list') {
    return (
      <div 
        className={`flex items-center gap-4 p-4 rounded-lg border transition-all cursor-pointer ${
          selected ? 'border-resonance-accent bg-resonance-accent/5' : 'border-resonance-border hover:border-resonance-accent/30'
        }`}
        onClick={onClick}
      >
        <button onClick={(e) => { e.stopPropagation(); onSelect(); }} className="text-resonance-text-muted">
          {selected ? '✓' : '○'}
        </button>
        <div className="flex-1">
          <h3 className="font-semibold text-resonance-text-primary">{design.name}</h3>
          <p className="text-sm text-resonance-text-secondary">{design.description || 'No description'}</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-resonance-text-muted">
          <span className="flex items-center gap-1"><Layers size={12} /> {design.blocks || 0}</span>
          <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(design.updatedAt).toLocaleDateString()}</span>
          {design.repoUrl && <GitBranch size={12} />}
        </div>
      </div>
    )
  }

  return (
    <div 
      className={`rounded-xl border overflow-hidden transition-all cursor-pointer group ${
        selected ? 'border-resonance-accent bg-resonance-accent/5' : 'border-resonance-border hover:border-resonance-accent/30 hover:shadow-lg'
      }`}
      onClick={onClick}
    >
      <div className="h-32 bg-resonance-bg-tertiary flex items-center justify-center relative">
        <Layers size={32} className="text-resonance-text-muted" />
        <button 
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          className="absolute top-2 right-2 w-6 h-6 rounded-full border flex items-center justify-center text-xs transition-colors"
        >
          {selected ? '✓' : ''}
        </button>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-resonance-text-primary mb-1">{design.name}</h3>
        <p className="text-sm text-resonance-text-secondary line-clamp-2 mb-3">{design.description || 'No description'}</p>
        <div className="flex items-center justify-between text-xs text-resonance-text-muted">
          <span className="flex items-center gap-1"><Layers size={12} /> {design.blocks || 0} blocks</span>
          <span>{new Date(design.updatedAt).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  )
}
