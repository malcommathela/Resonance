import React from 'react'
import { 
  GitBranch, Calendar, Layers, MoreVertical, Pencil, Copy, Trash2,
  FolderGit, FileCode, Zap
} from 'lucide-react'
import { Dropdown } from './Dropdown'

const ACCENT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7'
]

export const getRandomAccent = () => ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)]

export const DesignCard = ({ design, viewMode, selected, onSelect, onClick, onEdit, onDelete, onDuplicate }) => {
  const accent = design.accentColor || '#6366f1'
  const blockCount = design.blocks ?? design.nodeCount ?? 0
  const isRepoDesign = !!design.repoUrl

  const dropdownItems = [
    { icon: Pencil, label: 'Edit Details', onClick: () => onEdit?.(design) },
    { icon: Copy, label: 'Duplicate', onClick: () => onDuplicate?.(design) },
    { icon: Trash2, label: 'Delete', danger: true, onClick: () => onDelete?.(design.id) },
  ]

  // Repo design uses GitBranch icon, normal uses Layers
  const DesignIcon = isRepoDesign ? FolderGit : FileCode

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

        {/* Repo badge or accent dot */}
        {isRepoDesign ? (
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
            <GitBranch size={16} className="text-blue-500" />
          </div>
        ) : (
          <div 
            className="w-3 h-3 rounded-full shrink-0" 
            style={{ backgroundColor: accent }} 
          />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-resonance-text-primary truncate">{design.name}</h3>
            {isRepoDesign && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20">
                GitHub
              </span>
            )}
          </div>
          <p className="text-sm text-resonance-text-secondary truncate">{design.description || 'No description'}</p>
        </div>

        <div className="flex items-center gap-4 text-xs text-resonance-text-muted shrink-0">
          <span className="flex items-center gap-1"><Layers size={12} /> {blockCount}</span>
          <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(design.updatedAt).toLocaleDateString()}</span>
          {design.repoUrl && <GitBranch size={12} />}
        </div>

        <div onClick={(e) => e.stopPropagation()}>
          <Dropdown 
            trigger={<button className="p-1.5 rounded-lg hover:bg-resonance-bg-hover text-resonance-text-muted"><MoreVertical size={14} /></button>}
            items={dropdownItems}
            align="right"
          />
        </div>
      </div>
    )
  }

  return (
    <div 
      className={`rounded-xl border transition-all cursor-pointer group ${
        selected ? 'border-resonance-accent bg-resonance-accent/5' : 'border-resonance-border hover:border-resonance-accent/30 hover:shadow-lg'
      }`}
      onClick={onClick}
    >
      {/* Header image area */}
      <div className="h-32 bg-resonance-bg-tertiary flex items-center justify-center relative rounded-t-xl overflow-hidden">
        {/* Repo designs get a GitHub-themed header, normal get accent */}
        {isRepoDesign ? (
          <div 
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: '#3b82f615' }}
          >
            <FolderGit size={32} style={{ color: '#3b82f6' }} />
          </div>
        ) : (
          <div 
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: `${accent}15` }}
          >
            <FileCode size={32} style={{ color: accent }} />
          </div>
        )}

        {/* Selection checkbox */}
        <button 
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          className={`absolute top-2 right-2 w-6 h-6 rounded-full border flex items-center justify-center text-xs transition-colors ${
            selected ? 'bg-resonance-accent text-white border-resonance-accent' : 'border-resonance-border text-transparent hover:text-resonance-text-muted'
          }`}
        >
          {selected ? '✓' : ''}
        </button>

        {/* Top accent bar — repo designs get blue, normal get their accent */}
        <div 
          className="absolute top-0 left-0 w-full h-1" 
          style={{ backgroundColor: isRepoDesign ? '#3b82f6' : accent }} 
        />

        {/* Repo badge on card */}
        {isRepoDesign && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center gap-1">
            <GitBranch size={10} />
            GitHub
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="p-4 rounded-b-xl">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h3 className="font-semibold text-resonance-text-primary truncate">{design.name}</h3>
            {isRepoDesign && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20 shrink-0">
                Repo
              </span>
            )}
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <Dropdown 
              trigger={<button className="p-1 rounded-lg hover:bg-resonance-bg-hover text-resonance-text-muted opacity-0 group-hover:opacity-100 transition-opacity"><MoreVertical size={14} /></button>}
              items={dropdownItems}
              align="right"
            />
          </div>
        </div>

        <p className="text-sm text-resonance-text-secondary line-clamp-2 mb-3">{design.description || 'No description'}</p>

        <div className="flex items-center justify-between text-xs text-resonance-text-muted">
          <span className="flex items-center gap-1">
            <Layers size={12} /> {blockCount} blocks
          </span>
          <span className="flex items-center gap-1">
            <Calendar size={12} /> {new Date(design.updatedAt).toLocaleDateString()}
          </span>
        </div>

        {/* Repo URL hint */}
        {isRepoDesign && design.repoUrl && (
          <div className="mt-2 pt-2 border-t border-resonance-border/50 flex items-center gap-1 text-[10px] text-blue-500/70">
            <GitBranch size={10} />
            <span className="truncate">{design.repoUrl.replace('https://github.com/', '')}</span>
          </div>
        )}
      </div>
    </div>
  )
}