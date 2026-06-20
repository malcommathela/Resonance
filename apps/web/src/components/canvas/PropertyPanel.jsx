import React, { useState } from 'react'
import {
  X,
  Trash2,
  Copy,
  Settings,
  Palette,
  Box,
  GitBranch,
  HelpCircle,
} from 'lucide-react'
import { useCanvasStore } from '@/stores/canvasStore'
import { blockIconMap } from '@/lib/iconMap'
import { categories, CONNECTION_TYPE_META } from '@shared/constants'

export const PropertyPanel = () => {
  const {
    selectedNode,
    selectedEdge,
    updateNode,
    removeNode,
    setSelectedNode,
    updateEdgeData,
    removeEdge,
    setSelectedEdge,
    getAllBlockTypes,
    getAllConnectionTypes,
  } = useCanvasStore()

  const [showAddConfig, setShowAddConfig] = useState(false)
  const [newConfigKey, setNewConfigKey] = useState('')
  const [newConfigValue, setNewConfigValue] = useState('')

  if (selectedEdge) {
    return <EdgePropertyPanel
      edge={selectedEdge}
      onUpdate={updateEdgeData}
      onRemove={removeEdge}
      onClose={() => setSelectedEdge(null)}
      allTypes={getAllConnectionTypes()}
    />
  }

  if (!selectedNode) {
    return (
      <div className="w-72 bg-resonance-bg-panel border-l border-resonance-border flex flex-col shrink-0">
        <div className="p-4 border-b border-resonance-border">
          <h3 className="text-sm font-semibold text-resonance-text-primary">Properties</h3>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Settings size={32} className="text-resonance-text-muted mb-3" />
          <p className="text-sm text-resonance-text-secondary">Select a block or edge to edit its properties</p>
          <p className="text-xs text-resonance-text-muted mt-2">Click on any block or connection in the canvas</p>
        </div>
      </div>
    )
  }

  const data = selectedNode.data || {}
  // Safe fallback chain for icon component
  const IconComponent = blockIconMap[data.type] || blockIconMap[data.icon] || blockIconMap['service'] || HelpCircle
  const allBlockTypes = getAllBlockTypes() || []

  const handleConfigChange = (key, value) => {
    updateNode(selectedNode.id, {
      config: { ...data.config, [key]: value }
    })
  }

  const handleLabelChange = (value) => {
    updateNode(selectedNode.id, { label: value })
  }

  const handleTypeChange = (newTypeId) => {
    const typeDef = allBlockTypes.find(b => b.id === newTypeId)
    if (!typeDef) return
    updateNode(selectedNode.id, {
      type: newTypeId,
      icon: typeDef.icon,
      color: typeDef.color,
      category: typeDef.category,
    })
  }

  const handleColorChange = (color) => {
    updateNode(selectedNode.id, { color })
  }

  const handleCategoryChange = (category) => {
    updateNode(selectedNode.id, { category })
  }

  const handleIconChange = (iconName) => {
    updateNode(selectedNode.id, { icon: iconName })
  }

  const handleAddConfigField = () => {
    if (!newConfigKey.trim()) return
    let parsedValue = newConfigValue
    if (newConfigValue.toLowerCase() === 'true') parsedValue = true
    else if (newConfigValue.toLowerCase() === 'false') parsedValue = false
    else if (!isNaN(newConfigValue) && newConfigValue !== '') parsedValue = Number(newConfigValue)
    handleConfigChange(newConfigKey.trim(), parsedValue)
    setNewConfigKey('')
    setNewConfigValue('')
    setShowAddConfig(false)
  }

  const handleRemoveConfigField = (key) => {
    const newConfig = { ...data.config }
    delete newConfig[key]
    updateNode(selectedNode.id, { config: newConfig })
  }

  const allIcons = Object.keys(blockIconMap)
  const safeCategories = categories || []

  return (
    <div className="w-72 bg-resonance-bg-panel border-l border-resonance-border flex flex-col shrink-0 overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-resonance-border shrink-0">
        <h3 className="text-sm font-semibold text-resonance-text-primary">Properties</h3>
        <button
          onClick={() => setSelectedNode(null)}
          className="p-1 rounded-lg hover:bg-resonance-bg-hover transition-colors"
        >
          <X size={14} className="text-resonance-text-muted" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 border-b border-resonance-border">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${data.color || '#8b5cf6'}15` }}
            >
              <IconComponent size={20} style={{ color: data.color || '#8b5cf6' }} />
            </div>
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={data.label || ''}
                onChange={(e) => handleLabelChange(e.target.value)}
                className="text-sm font-semibold text-resonance-text-primary bg-transparent border-none focus:outline-none focus:ring-0 p-0 w-full"
                placeholder="Block name"
              />
              <p className="text-xs text-resonance-text-muted capitalize">{(data.type || 'service').replace(/-/g, ' ')}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => removeNode(selectedNode.id)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 text-xs font-medium hover:bg-red-500/20 transition-colors"
            >
              <Trash2 size={12} />
              Delete
            </button>
            <button
              onClick={() => {
                const newNode = {
                  ...selectedNode,
                  id: `${data.type || 'block'}-${Date.now()}`,
                  position: { x: selectedNode.position.x + 40, y: selectedNode.position.y + 40 },
                }
                useCanvasStore.getState().setNodes([...useCanvasStore.getState().nodes, newNode])
              }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-resonance-bg-tertiary text-resonance-text-secondary text-xs font-medium hover:bg-resonance-bg-hover transition-colors"
            >
              <Copy size={12} />
              Duplicate
            </button>
          </div>
        </div>

        <div className="p-4 border-b border-resonance-border">
          <h4 className="text-xs font-semibold text-resonance-text-secondary uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Palette size={12} />
            Appearance
          </h4>

          <div className="space-y-2 mb-3">
            <label className="text-xs text-resonance-text-muted">Color</label>
            <div className="flex flex-wrap gap-1.5">
              {['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#6366f1', '#84cc16', '#14b8a6'].map(color => (
                <button
                  key={color}
                  onClick={() => handleColorChange(color)}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${
                    data.color === color ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
              <input
                type="color"
                value={data.color || '#8b5cf6'}
                onChange={(e) => handleColorChange(e.target.value)}
                className="w-6 h-6 rounded-full border-0 p-0 overflow-hidden cursor-pointer"
                title="Custom color"
              />
            </div>
          </div>

          <div className="space-y-2 mb-3">
            <label className="text-xs text-resonance-text-muted">Icon</label>
            <div className="flex flex-wrap gap-1">
              {allIcons.slice(0, 12).map(iconName => {
                const Icon = blockIconMap[iconName]
                if (!Icon) return null
                return (
                  <button
                    key={iconName}
                    onClick={() => handleIconChange(iconName)}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                      data.icon === iconName
                        ? 'bg-resonance-accent/20 text-resonance-accent'
                        : 'bg-resonance-bg-tertiary text-resonance-text-muted hover:text-resonance-text-secondary'
                    }`}
                    title={iconName}
                  >
                    <Icon size={14} />
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-resonance-text-muted">Category</label>
            <select
              value={data.category || 'other'}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full px-3 py-1.5 bg-resonance-bg-tertiary border border-resonance-border rounded-lg text-sm text-resonance-text-primary focus:outline-none focus:ring-2 focus:ring-resonance-accent/30 focus:border-resonance-accent transition-all"
            >
              {safeCategories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-4 border-b border-resonance-border">
          <h4 className="text-xs font-semibold text-resonance-text-secondary uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Box size={12} />
            Block Type
          </h4>
          <select
            value={data.type || 'service'}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="w-full px-3 py-1.5 bg-resonance-bg-tertiary border border-resonance-border rounded-lg text-sm text-resonance-text-primary focus:outline-none focus:ring-2 focus:ring-resonance-accent/30 focus:border-resonance-accent transition-all"
          >
            {allBlockTypes.map(block => (
              <option key={block.id} value={block.id}>{block.label}</option>
            ))}
          </select>
        </div>

        <div className="p-4">
          <h4 className="text-xs font-semibold text-resonance-text-secondary uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Settings size={12} />
            Configuration
          </h4>

          <div className="space-y-2">
            {Object.entries(data.config || {}).map(([key, value]) => (
              <div key={key} className="group">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-resonance-text-muted capitalize">{key.replace(/-/g, ' ')}</label>
                  <button
                    onClick={() => handleRemoveConfigField(key)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/10 text-red-500 transition-all"
                    title="Remove field"
                  >
                    <X size={10} />
                  </button>
                </div>
                <ConfigInput
                  value={value}
                  onChange={(v) => handleConfigChange(key, v)}
                />
              </div>
            ))}
          </div>

          {showAddConfig ? (
            <div className="mt-3 p-2 bg-resonance-bg-tertiary rounded-lg border border-resonance-border">
              <input
                type="text"
                placeholder="Field name"
                value={newConfigKey}
                onChange={(e) => setNewConfigKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && newConfigKey.trim() && document.getElementById('config-value-input')?.focus()}
                className="w-full px-2 py-1 bg-resonance-bg-secondary border border-resonance-border rounded text-xs text-resonance-text-primary placeholder-resonance-text-muted focus:outline-none focus:border-resonance-accent mb-1.5"
                autoFocus
              />
              <input
                id="config-value-input"
                type="text"
                placeholder="Value"
                value={newConfigValue}
                onChange={(e) => setNewConfigValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddConfigField()}
                className="w-full px-2 py-1 bg-resonance-bg-secondary border border-resonance-border rounded text-xs text-resonance-text-primary placeholder-resonance-text-muted focus:outline-none focus:border-resonance-accent mb-1.5"
              />
              <div className="flex gap-1.5">
                <button
                  onClick={handleAddConfigField}
                  disabled={!newConfigKey.trim()}
                  className="flex-1 px-2 py-1 rounded bg-resonance-accent text-white text-[10px] font-medium hover:bg-resonance-accent/90 disabled:opacity-40 transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => { setShowAddConfig(false); setNewConfigKey(''); setNewConfigValue('') }}
                  className="px-2 py-1 rounded bg-resonance-bg-hover text-resonance-text-secondary text-[10px] hover:text-resonance-text-primary transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddConfig(true)}
              className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-resonance-border text-xs text-resonance-text-muted hover:text-resonance-text-secondary hover:border-resonance-text-secondary transition-all"
            >
              <Copy size={12} />
              Add Custom Field
            </button>
          )}
        </div>

        {data.metrics && (
          <div className="p-4 border-t border-resonance-border">
            <h4 className="text-xs font-semibold text-resonance-text-secondary uppercase tracking-wider mb-3">
              Simulation Metrics
            </h4>
            <div className="space-y-2">
              <MetricRow label="Requests/sec" value={data.metrics.rps} />
              <MetricRow label="Latency" value={`${data.metrics.latency}ms`} />
              <MetricRow label="Errors" value={data.metrics.errors} color={data.metrics.errors > 10 ? 'text-red-500' : 'text-green-500'} />
              <MetricRow label="P95" value={`${data.metrics.p95Latency}ms`} />
              <MetricRow label="P99" value={`${data.metrics.p99Latency}ms`} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const EdgePropertyPanel = ({ edge, onUpdate, onRemove, onClose, allTypes }) => {
  const data = edge.data || {}
  const meta = CONNECTION_TYPE_META[data.connectionType] || CONNECTION_TYPE_META['http'] || { label: 'HTTP', color: '#3b82f6' }

  const handleTypeChange = (typeId) => {
    onUpdate(edge.id, { connectionType: typeId })
  }

  const handleLabelChange = (label) => {
    onUpdate(edge.id, { label })
  }

  const handleColorChange = (color) => {
    onUpdate(edge.id, { customColor: color })
  }

  return (
    <div className="w-72 bg-resonance-bg-panel border-l border-resonance-border flex flex-col shrink-0 overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-resonance-border shrink-0">
        <h3 className="text-sm font-semibold text-resonance-text-primary flex items-center gap-1.5">
          <GitBranch size={14} />
          Edge Properties
        </h3>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-resonance-bg-hover transition-colors">
          <X size={14} className="text-resonance-text-muted" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="text-xs text-resonance-text-muted mb-1.5 block">Connection Type</label>
          <div className="space-y-1">
            {(allTypes || []).map(type => {
              const typeMeta = CONNECTION_TYPE_META[type.id] || { color: type.color, label: type.label }
              return (
                <button
                  key={type.id}
                  onClick={() => handleTypeChange(type.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                    data.connectionType === type.id
                      ? 'bg-resonance-accent/10 text-resonance-accent border border-resonance-accent/30'
                      : 'text-resonance-text-secondary hover:bg-resonance-bg-hover border border-transparent'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: typeMeta.color || type.color }} />
                  <span className="font-medium">{typeMeta.label || type.label}</span>
                  <span className="text-xs text-resonance-text-muted ml-auto">{type.id}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="text-xs text-resonance-text-muted mb-1.5 block">Label</label>
          <input
            type="text"
            value={data.label || ''}
            onChange={(e) => handleLabelChange(e.target.value)}
            placeholder="Optional label..."
            className="w-full px-3 py-1.5 bg-resonance-bg-tertiary border border-resonance-border rounded-lg text-sm text-resonance-text-primary placeholder-resonance-text-muted focus:outline-none focus:ring-2 focus:ring-resonance-accent/30 focus:border-resonance-accent transition-all"
          />
        </div>

        <div>
          <label className="text-xs text-resonance-text-muted mb-1.5 block">Custom Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={data.customColor || meta.color || '#3b82f6'}
              onChange={(e) => handleColorChange(e.target.value)}
              className="w-8 h-8 rounded-lg border-0 p-0 overflow-hidden cursor-pointer"
            />
            <span className="text-xs text-resonance-text-muted">{data.customColor || meta.color || '#3b82f6'}</span>
          </div>
        </div>

        <div className="p-3 bg-resonance-bg-tertiary rounded-lg border border-resonance-border">
          <p className="text-xs text-resonance-text-muted mb-1">From → To</p>
          <p className="text-sm text-resonance-text-secondary font-mono">{edge.source}</p>
          <p className="text-sm text-resonance-text-secondary font-mono">{edge.target}</p>
        </div>

        <button
          onClick={() => { onRemove(edge.id); onClose() }}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 text-red-500 text-xs font-medium hover:bg-red-500/20 transition-colors"
        >
          <Trash2 size={12} />
          Delete Edge
        </button>
      </div>
    </div>
  )
}

const MetricRow = ({ label, value, color = 'text-resonance-text-primary' }) => (
  <div className="flex items-center justify-between py-1">
    <span className="text-xs text-resonance-text-muted">{label}</span>
    <span className={`text-xs font-mono font-medium ${color}`}>{value}</span>
  </div>
)

const ConfigInput = ({ value, onChange }) => {
  if (typeof value === 'boolean') {
    return (
      <button
        onClick={() => onChange(!value)}
        className={`relative w-10 h-5 rounded-full transition-colors ${
          value ? 'bg-resonance-accent' : 'bg-resonance-bg-tertiary border border-resonance-border'
        }`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
          value ? 'translate-x-5' : 'translate-x-0.5'
        }`} />
      </button>
    )
  }

  if (typeof value === 'number') {
    return (
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full px-3 py-1.5 bg-resonance-bg-tertiary border border-resonance-border rounded-lg text-sm text-resonance-text-primary focus:outline-none focus:ring-2 focus:ring-resonance-accent/30 focus:border-resonance-accent transition-all"
      />
    )
  }

  return (
    <input
      type="text"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-1.5 bg-resonance-bg-tertiary border border-resonance-border rounded-lg text-sm text-resonance-text-primary placeholder-resonance-text-muted focus:outline-none focus:ring-2 focus:ring-resonance-accent/30 focus:border-resonance-accent transition-all"
    />
  )
}