import React, { useState } from 'react'
import {
  Search,
  ChevronRight,
  ChevronDown,
  Plus,
} from 'lucide-react'
import { BLOCK_TYPES, categories } from '@shared/constants'
import { libraryIconMap } from '@/lib/iconMap'
import { useCanvasStore } from '@/stores/canvasStore'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

export const BlockLibrary = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState(categories.map(c => c.id))
  const [showCreateModal, setShowCreateModal] = useState(false)
  const { customBlockTypes, addCustomBlockType, getAllBlockTypes } = useCanvasStore()

  const allBlockTypes = getAllBlockTypes()

  const toggleCategory = (catId) => {
    setExpandedCategories(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    )
  }

  const filteredBlocks = searchQuery
    ? allBlockTypes.filter(b =>
        b.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.id.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allBlockTypes

  const onDragStart = (event, blockType) => {
    event.dataTransfer.setData('application/resonance-block', blockType)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="w-64 bg-resonance-bg-sidebar border-r border-resonance-border flex flex-col shrink-0">
      <div className="p-3 border-b border-resonance-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-resonance-text-primary">Block Library</h3>
          <button
            onClick={() => setShowCreateModal(true)}
            className="p-1 rounded-lg hover:bg-resonance-bg-hover text-resonance-text-muted hover:text-resonance-accent transition-colors"
            title="Create Custom Block"
          >
            <Plus size={14} />
          </button>
        </div>
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

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {searchQuery ? (
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
                    {block.isCustom && (
                      <span className="text-[10px] text-resonance-accent">Custom</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          categories.map(category => {
            const categoryBlocks = allBlockTypes.filter(b => b.category === category.id)
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
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-resonance-text-primary truncate">{block.label}</p>
                            {block.isCustom && (
                              <span className="text-[10px] text-resonance-accent">Custom</span>
                            )}
                          </div>
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

      <div className="p-3 border-t border-resonance-border">
        <p className="text-xs text-resonance-text-muted text-center">
          Drag blocks to the canvas
        </p>
      </div>

      <CreateCustomBlockModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={(blockDef) => {
          addCustomBlockType(blockDef)
          setShowCreateModal(false)
        }}
      />
    </div>
  )
}

const CreateCustomBlockModal = ({ isOpen, onClose, onCreate }) => {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('compute')
  const [color, setColor] = useState('#8b5cf6')
  const [icon, setIcon] = useState('Server')
  const [description, setDescription] = useState('')
  const [baseType, setBaseType] = useState('service')

  const allIcons = Object.keys(libraryIconMap).slice(0, 16)

  const handleCreate = () => {
    if (!name.trim()) return
    const baseBlock = BLOCK_TYPES.find(b => b.id === baseType)
    onCreate({
      label: name.trim(),
      category,
      color,
      icon,
      description: description.trim() || baseBlock?.label || '',
      baseType,
    })
    setName('')
    setCategory('compute')
    setColor('#8b5cf6')
    setIcon('Server')
    setDescription('')
    setBaseType('service')
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Custom Block" size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-resonance-text-muted mb-1.5">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Auth Service"
            className="w-full px-3 py-2 bg-resonance-bg-tertiary border border-resonance-border rounded-lg text-sm text-resonance-text-primary placeholder-resonance-text-muted focus:outline-none focus:ring-2 focus:ring-resonance-accent/30 focus:border-resonance-accent transition-all"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs text-resonance-text-muted mb-1.5">Base Type (inherits config)</label>
          <select
            value={baseType}
            onChange={(e) => setBaseType(e.target.value)}
            className="w-full px-3 py-2 bg-resonance-bg-tertiary border border-resonance-border rounded-lg text-sm text-resonance-text-primary focus:outline-none focus:ring-2 focus:ring-resonance-accent/30 focus:border-resonance-accent transition-all"
          >
            {BLOCK_TYPES.map(block => (
              <option key={block.id} value={block.id}>{block.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-resonance-text-muted mb-1.5">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 bg-resonance-bg-tertiary border border-resonance-border rounded-lg text-sm text-resonance-text-primary focus:outline-none focus:ring-2 focus:ring-resonance-accent/30 focus:border-resonance-accent transition-all"
          >
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-resonance-text-muted mb-1.5">Color</label>
          <div className="flex flex-wrap gap-1.5">
            {['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#6366f1', '#84cc16', '#14b8a6'].map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full border-2 transition-all ${
                  color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-7 h-7 rounded-full border-0 p-0 overflow-hidden cursor-pointer"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-resonance-text-muted mb-1.5">Icon</label>
          <div className="flex flex-wrap gap-1">
            {allIcons.map(iconName => {
              const Icon = libraryIconMap[iconName]
              if (!Icon) return null
              return (
                <button
                  key={iconName}
                  onClick={() => setIcon(iconName)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                    icon === iconName
                      ? 'bg-resonance-accent/20 text-resonance-accent border border-resonance-accent/30'
                      : 'bg-resonance-bg-tertiary text-resonance-text-muted hover:text-resonance-text-secondary border border-transparent'
                  }`}
                  title={iconName}
                >
                  <Icon size={16} />
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs text-resonance-text-muted mb-1.5">Description (optional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this block do?"
            className="w-full px-3 py-2 bg-resonance-bg-tertiary border border-resonance-border rounded-lg text-sm text-resonance-text-primary placeholder-resonance-text-muted focus:outline-none focus:ring-2 focus:ring-resonance-accent/30 focus:border-resonance-accent transition-all"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!name.trim()}>Create Block</Button>
        </div>
      </div>
    </Modal>
  )
}