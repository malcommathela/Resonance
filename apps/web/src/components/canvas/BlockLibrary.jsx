import React, { useState } from 'react'
import {
  Search,
  ChevronRight,
  ChevronDown,
} from 'lucide-react'
import { BLOCK_TYPES } from '@shared/constants'
import { libraryIconMap } from '@/lib/iconMap'
import { categories } from '@/lib/blocks'

export const BlockLibrary = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState(categories.map(c => c.id))

  const toggleCategory = (catId) => {
    setExpandedCategories(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    )
  }

  const filteredBlocks = searchQuery
    ? BLOCK_TYPES.filter(b =>
        b.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.id.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : BLOCK_TYPES

  const onDragStart = (event, blockType) => {
    event.dataTransfer.setData('application/resonance-block', blockType)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="w-64 bg-resonance-bg-sidebar border-r border-resonance-border flex flex-col shrink-0">
      {/* Header */}
      <div className="p-3 border-b border-resonance-border">
        <h3 className="text-sm font-semibold text-resonance-text-primary mb-2">Block Library</h3>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-resonance-text-muted" />
          <input
            type="text"
            placeholder="Search blocks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-resonance-bg-tertiary border border-resonance-border rounded-lg text-xs text-resonance-text-primary placeholder-resonance-text-muted focus:outline-none focus:ring-2 focus:ring-resonance-accent/30 focus:border-resonance-accent transition-all"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {searchQuery ? (
          // Flat list when searching
          <div className="space-y-1">
            {filteredBlocks.map(block => {
              const IconComponent = libraryIconMap[block.icon] || libraryIconMap['Server']
              return (
                <div
                  key={block.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, block.id)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-resonance-bg-hover cursor-grab active:cursor-grabbing transition-colors group"
                >
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${block.color}15` }}
                  >
                    <IconComponent size={14} style={{ color: block.color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-resonance-text-primary truncate">{block.label}</p>
                    <p className="text-xs text-resonance-text-muted">{block.category}</p>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          // Categorized list
          categories.map(category => {
            const categoryBlocks = BLOCK_TYPES.filter(b => b.category === category.id)
            if (categoryBlocks.length === 0) return null

            const isExpanded = expandedCategories.includes(category.id)

            return (
              <div key={category.id}>
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-resonance-bg-hover transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown size={14} className="text-resonance-text-muted" />
                  ) : (
                    <ChevronRight size={14} className="text-resonance-text-muted" />
                  )}
                  <span className="text-xs font-semibold text-resonance-text-secondary uppercase tracking-wider">
                    {category.label}
                  </span>
                  <span className="text-xs text-resonance-text-muted ml-auto">{categoryBlocks.length}</span>
                </button>

                {isExpanded && (
                  <div className="ml-2 space-y-0.5 mt-1">
                    {categoryBlocks.map(block => {
                      const IconComponent = libraryIconMap[block.icon] || libraryIconMap['Server']
                      return (
                        <div
                          key={block.id}
                          draggable
                          onDragStart={(e) => onDragStart(e, block.id)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-resonance-bg-hover cursor-grab active:cursor-grabbing transition-colors group"
                        >
                          <div
                            className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${block.color}15` }}
                          >
                            <IconComponent size={14} style={{ color: block.color }} />
                          </div>
                          <span className="text-sm text-resonance-text-primary truncate">{block.label}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Footer hint */}
      <div className="p-3 border-t border-resonance-border">
        <p className="text-xs text-resonance-text-muted text-center">
          Drag blocks to the canvas
        </p>
      </div>
    </div>
  )
}
