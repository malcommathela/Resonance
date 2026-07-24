import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import {
  X,
  Trash2,
  Copy,
  Settings,
  Palette,
  Box,
  GitBranch,
  HelpCircle,
  Cpu,
  MemoryStick,
  HardDrive,
  Gauge,
  AlertTriangle,
  Shield,
  DollarSign,
  Layers,
  Zap,
  Server,
  Network,
  Activity,
  Clock,
  Pencil,
  Layout,
  Wrench,
  PanelRightClose,
  PanelRightOpen,
  SlidersHorizontal,
  ShieldCheck,
  AlertOctagon,
  BarChart3,
} from 'lucide-react'
import { useCanvasStore } from '@/stores/canvasStore'
import { blockIconMap } from '@/lib/iconMap'
import { categories, CONNECTION_TYPE_META, getBlockBehavioralModel, getConnectionBehavioralModel } from '@shared/constants'
import { DECORATIVE_PROPS } from '@/stores/canvasStore'
import { validateSingleProperty } from '@/lib/validation'

// ============================================================================
// TAB CONFIGURATION
// ============================================================================

export const TABS = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'performance', label: 'Performance', icon: Zap },
  { id: 'reliability', label: 'Reliability', icon: Shield },
  { id: 'resources', label: 'Resources', icon: Cpu },
  { id: 'scaling', label: 'Scaling', icon: Layers },
  { id: 'cost', label: 'Cost', icon: DollarSign },
  { id: 'custom', label: 'Custom', icon: Wrench },
]

const PROPERTY_TAB_MAP = {
  // Appearance
  type: 'appearance',
  icon: 'appearance',
  color: 'appearance',
  category: 'appearance',
  // Performance
  maxThroughput: 'performance',
  maxConcurrent: 'performance',
  maxQueueDepth: 'performance',
  maxConnections: 'performance',
  baseLatencyMs: 'performance',
  latencyStdDevMs: 'performance',
  queueLatencyMs: 'performance',
  cacheHitLatencyMs: 'performance',
  cacheMissLatencyMs: 'performance',
  cacheHitRate: 'performance',
  // Reliability
  baseErrorRate: 'reliability',
  errorRateUnderLoad: 'reliability',
  errorDistribution: 'reliability',
  slaTarget: 'reliability',
  mttrMinutes: 'reliability',
  mtbfHours: 'reliability',
  // Resources
  cpuPerRequest: 'resources',
  memoryPerConnection: 'resources',
  threadPoolSize: 'resources',
  connectionPoolSize: 'resources',
  // Scaling
  scalingType: 'scaling',
  scaleUpThreshold: 'scaling',
  scaleDownThreshold: 'scaling',
  minReplicas: 'scaling',
  maxReplicas: 'scaling',
  // Cost
  hourlyComputeCost: 'cost',
  perRequestCost: 'cost',
  perGbNetworkCost: 'cost',
}

export const PropertyPanel = forwardRef(({ 
  collapsed = false, 
  onToggleCollapse, 
  onToggleValidation,
  validationResult,
  isValidating,
  onRunValidation,
  activeTab: controlledActiveTab,
  onTabChange,
}, ref) => {
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
    duplicateNode,
  } = useCanvasStore()

  const [activeTab, setActiveTab] = useState(controlledActiveTab || 'appearance')
  const [fieldValidation, setFieldValidation] = useState({})
  const [showAddConfig, setShowAddConfig] = useState(false)
  const [newConfigKey, setNewConfigKey] = useState('')
  const [newConfigValue, setNewConfigValue] = useState('')

  // Sync external tab control
  useEffect(() => {
    if (controlledActiveTab !== undefined) {
      setActiveTab(controlledActiveTab)
    }
  }, [controlledActiveTab])

  // Reset tab & validation when switching blocks
  useEffect(() => {
    setActiveTab('appearance')
    setFieldValidation({})
  }, [selectedNode?.id])

  // BATCH 4: Expose scrollToProperty for Jump-to-Property from ValidationPanel
  useImperativeHandle(ref, () => ({
    scrollToProperty: (propertyName) => {
      const tabId = PROPERTY_TAB_MAP[propertyName] || 'custom'
      setActiveTab(tabId)
      onTabChange?.(tabId)
      // Wait for tab render then scroll + flash
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = document.querySelector(`[data-property="${propertyName}"]`)
          if (!el) return
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          el.classList.add('ring-2', 'ring-red-500', 'rounded-lg')
          setTimeout(() => el.classList.remove('ring-2', 'ring-red-500', 'rounded-lg'), 1500)
        })
      })
    }
  }))

  // Validate a single field and update component state
  const validateField = (propertyName, value) => {
    if (!selectedNode) return
    const block = useCanvasStore.getState().nodes.find(n => n.id === selectedNode.id)
    if (!block) return
    const result = validateSingleProperty(block, propertyName, value)
    setFieldValidation(prev => {
      const next = { ...prev, [propertyName]: result }
      const b = (section, key) => block.data?.config?.behavioralModel?.[section]?.[key]

      // Cross-field re-validation
      if (propertyName === 'minReplicas' && prev.maxReplicas !== undefined) {
        next.maxReplicas = validateSingleProperty(block, 'maxReplicas', b('scalingBehavior', 'maxReplicas'))
      }
      if (propertyName === 'scaleUpThreshold' && prev.scaleDownThreshold !== undefined) {
        next.scaleDownThreshold = validateSingleProperty(block, 'scaleDownThreshold', b('scalingBehavior', 'scaleDownThreshold'))
      }
      if (propertyName === 'mttrMinutes' && prev.mtbfHours !== undefined) {
        next.mtbfHours = validateSingleProperty(block, 'mtbfHours', b('availability', 'mtbfHours'))
      }
      return next
    })
  }

  // === COLLAPSED STATE ===
  if (collapsed) {
    const hasCritical = validationResult?.findings?.some(f => f.severity === 'critical')
    const hasWarning = validationResult?.findings?.some(f => f.severity === 'warning')
    const findingCount = validationResult?.findings?.length || 0

    return (
      <div
        className="shrink-0 bg-resonance-bg-panel border-l border-resonance-border flex flex-col items-center py-3 gap-2 overflow-hidden"
        style={{ width: 48, transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)' }}
      >
        <button
          onClick={onToggleCollapse}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-resonance-text-muted hover:text-resonance-text-primary hover:bg-resonance-bg-hover transition-colors"
          title="Expand Properties Panel"
        >
          <PanelRightOpen size={16} />
        </button>

        <div className="w-6 h-px bg-resonance-border my-1" />

        {/* Validation toggle icon — at top, separated by divider */}
        <button
          onClick={onToggleValidation}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors group relative ${
            hasCritical
              ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
              : hasWarning
              ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
              : findingCount > 0
              ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
              : 'bg-resonance-bg-hover text-resonance-text-muted hover:text-resonance-text-primary'
          }`}
          title={validationResult ? `Validation: ${findingCount} findings` : 'Open Validation Panel'}
        >
          {hasCritical ? (
            <AlertOctagon size={16} />
          ) : hasWarning ? (
            <AlertTriangle size={16} />
          ) : findingCount > 0 ? (
            <ShieldCheck size={16} />
          ) : (
            <BarChart3 size={16} />
          )}
          {/* Tooltip */}
          <span className="absolute right-full mr-2 px-2 py-1 bg-resonance-bg-elevated border border-resonance-border rounded-lg text-xs text-resonance-text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
            {validationResult ? `${findingCount} finding${findingCount !== 1 ? 's' : ''}` : 'Validation'}
          </span>
        </button>

        {/* Re-run validation from collapsed state */}
        <button
          onClick={onRunValidation}
          disabled={isValidating}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-resonance-text-muted hover:text-resonance-accent hover:bg-resonance-bg-hover transition-colors disabled:opacity-40 group relative"
          title="Run Validation"
        >
          {isValidating ? (
            <div className="w-4 h-4 border-2 border-resonance-text-muted border-t-resonance-accent rounded-full animate-spin" />
          ) : (
            <Zap size={14} />
          )}
          <span className="absolute right-full mr-2 px-2 py-1 bg-resonance-bg-elevated border border-resonance-border rounded-lg text-xs text-resonance-text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
            {isValidating ? 'Validating...' : 'Run Validation'}
          </span>
        </button>

        <div className="w-6 h-px bg-resonance-border my-1" />

        {/* Tab quick-access icons */}
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-resonance-text-muted hover:text-resonance-text-primary hover:bg-resonance-bg-hover transition-colors group relative"
              title={tab.label}
            >
              <Icon size={16} />
              <span className="absolute right-full mr-2 px-2 py-1 bg-resonance-bg-elevated border border-resonance-border rounded-lg text-xs text-resonance-text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
                {tab.label}
              </span>
            </button>
          )
        })}

        <div className="w-6 h-px bg-resonance-border my-1" />

        {/* Selected block indicator */}
        {selectedNode && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-resonance-accent/10 text-resonance-accent">
            <SlidersHorizontal size={14} />
          </div>
        )}
        {selectedEdge && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-resonance-accent/10 text-resonance-accent">
            <GitBranch size={14} />
          </div>
        )}
      </div>
    )
  }

  // --------------------------------------------------------------------------
  // EDGE PANEL
  // --------------------------------------------------------------------------
  if (selectedEdge) {
    return (
      <div
        className="shrink-0 bg-resonance-bg-panel border-l border-resonance-border flex flex-col overflow-hidden"
        style={{ width: 320, transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)' }}
      >
        <div className="flex items-center justify-between p-3 border-b border-resonance-border shrink-0">
          <h3 className="text-sm font-semibold text-resonance-text-primary flex items-center gap-1.5">
            <GitBranch size={14} />
            Edge Properties
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded-lg hover:bg-resonance-bg-hover text-resonance-text-muted hover:text-resonance-text-primary transition-colors"
              title="Collapse Properties Panel"
            >
              <PanelRightClose size={14} />
            </button>
            <button onClick={() => setSelectedEdge(null)} className="p-1 rounded-lg hover:bg-resonance-bg-hover transition-colors">
              <X size={14} className="text-resonance-text-muted" />
            </button>
          </div>
        </div>
        <EdgePropertyPanel
          edge={selectedEdge}
          onUpdate={updateEdgeData}
          onRemove={removeEdge}
          onClose={() => setSelectedEdge(null)}
          allTypes={getAllConnectionTypes()}
        />
      </div>
    )
  }

  // --------------------------------------------------------------------------
  // EMPTY STATE
  // --------------------------------------------------------------------------
  if (!selectedNode) {
    return (
      <div
        className="shrink-0 bg-resonance-bg-panel border-l border-resonance-border flex flex-col overflow-hidden"
        style={{ width: 320, transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)' }}
      >
        <div className="flex items-center justify-between p-4 border-b border-resonance-border">
          <h3 className="text-sm font-semibold text-resonance-text-primary">Properties</h3>
          <div className="flex items-center gap-1">
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded-lg hover:bg-resonance-bg-hover text-resonance-text-muted hover:text-resonance-text-primary transition-colors"
              title="Collapse Properties Panel"
            >
              <PanelRightClose size={14} />
            </button>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Settings size={32} className="text-resonance-text-muted mb-3" />
          <p className="text-sm text-resonance-text-secondary">Select a block or edge to edit its properties</p>
          <p className="text-xs text-resonance-text-muted mt-2">Click on any block or connection in the canvas</p>
        </div>
      </div>
    )
  }

  // --------------------------------------------------------------------------
  // BLOCK DATA
  // --------------------------------------------------------------------------
  const data = selectedNode.data || {}
  const IconComponent = blockIconMap[data.icon] || blockIconMap[data.type] || blockIconMap['service'] || HelpCircle
  const allBlockTypes = getAllBlockTypes() || []
  const behavioralModel = data.config?.behavioralModel || getBlockBehavioralModel(data.type) || {}

  const handleConfigChange = (key, value) => {
    updateNode(selectedNode.id, {
      config: { ...data.config, [key]: value }
    })
  }

  const handleBehavioralChange = (section, key, value) => {
    const currentModel = data.config?.behavioralModel || {}
    updateNode(selectedNode.id, {
      config: {
        ...data.config,
        behavioralModel: {
          ...currentModel,
          [section]: {
            ...currentModel[section],
            [key]: value,
          },
        },
      },
    })
  }

  const handleLabelChange = (value) => {
    updateNode(selectedNode.id, { label: value })
  }

  const handleTypeChange = (newTypeId) => {
    const typeDef = allBlockTypes.find(b => b.id === newTypeId)
    if (!typeDef) return
    const newBehavioral = getBlockBehavioralModel(newTypeId)
    updateNode(selectedNode.id, {
      type: newTypeId,
      icon: typeDef.icon,
      color: typeDef.color,
      category: typeDef.category,
      config: {
        ...data.config,
        behavioralModel: newBehavioral,
      },
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
    const key = newConfigKey.trim()
    if (DECORATIVE_PROPS.has(key)) {
      setNewConfigKey('')
      setNewConfigValue('')
      setShowAddConfig(false)
      return
    }
    let parsedValue = newConfigValue
    if (newConfigValue.toLowerCase() === 'true') parsedValue = true
    else if (newConfigValue.toLowerCase() === 'false') parsedValue = false
    else if (!isNaN(newConfigValue) && newConfigValue !== '') parsedValue = Number(newConfigValue)
    handleConfigChange(key, parsedValue)
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
  const genericConfig = Object.entries(data.config || {}).filter(
    ([key]) => key !== 'behavioralModel' && !DECORATIVE_PROPS.has(key)
  )
  const hiddenDecorativeCount = Object.keys(data.config || {}).filter(
    key => key !== 'behavioralModel' && DECORATIVE_PROPS.has(key)
  ).length

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------
  return (
    <div
      className="shrink-0 bg-resonance-bg-panel border-l border-resonance-border flex flex-col overflow-hidden"
      style={{ width: 320, transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)' }}
    >
      {/* Title bar */}
      <div className="flex items-center justify-between p-3 border-b border-resonance-border shrink-0">
        <h3 className="text-sm font-semibold text-resonance-text-primary">Properties</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded-lg hover:bg-resonance-bg-hover text-resonance-text-muted hover:text-resonance-text-primary transition-colors"
            title="Collapse Properties Panel"
          >
            <PanelRightClose size={14} />
          </button>
          <button
            onClick={() => setSelectedNode(null)}
            className="p-1 rounded-lg hover:bg-resonance-bg-hover transition-colors"
          >
            <X size={14} className="text-resonance-text-muted" />
          </button>
        </div>
      </div>

      {/* Block header */}
      <div className="p-4 border-b border-resonance-border shrink-0">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${data.color || '#8b5cf6'}15` }}
          >
            <IconComponent size={20} style={{ color: data.color || '#8b5cf6' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="group flex items-center gap-1">
              <input
                type="text"
                value={data.label || ''}
                onChange={(e) => handleLabelChange(e.target.value)}
                className="text-sm font-semibold text-resonance-text-primary bg-transparent border border-transparent hover:border-resonance-border focus:border-resonance-accent focus:bg-resonance-bg-tertiary rounded-lg px-1.5 py-0.5 -mx-1.5 focus:outline-none focus:ring-2 focus:ring-resonance-accent/20 w-full transition-all"
                placeholder="Block name"
                data-canvas-input="true"
              />
              <Pencil size={12} className="text-resonance-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </div>
            <p className="text-xs text-resonance-text-muted capitalize">{(data.type || 'service').replace(/-/g, ' ')}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => removeNode(selectedNode.id)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 text-red-500 text-xs font-medium hover:bg-red-500/20 transition-colors"
          >
            <Trash2 size={12} />
            Delete
          </button>
          <button
            onClick={() => duplicateNode(selectedNode.id)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-resonance-bg-tertiary text-resonance-text-secondary text-xs font-medium hover:bg-resonance-bg-hover transition-colors"
          >
            <Copy size={12} />
            Duplicate
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-resonance-border shrink-0 scrollbar-none">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                onTabChange?.(tab.id)
              }}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${
                isActive
                  ? 'text-resonance-accent border-resonance-accent bg-resonance-accent/5'
                  : 'text-resonance-text-muted border-transparent hover:text-resonance-text-secondary hover:bg-resonance-bg-hover'
              }`}
            >
              <Icon size={13} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* ── APPEARANCE ── */}
          {activeTab === 'appearance' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-resonance-text-muted">Block Type</label>
                <select
                  value={data.type || 'service'}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="w-full px-3 py-1.5 bg-resonance-bg-tertiary border border-resonance-border rounded-xl text-sm text-resonance-text-primary focus:outline-none focus:ring-2 focus:ring-resonance-accent/30 focus:border-resonance-accent transition-all"
                  data-canvas-input="true"
                >
                  {allBlockTypes.map(block => (
                    <option key={block.id} value={block.id}>{block.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
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
                    data-canvas-input="true"
                  />
                </div>
              </div>

              <div className="space-y-2">
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
                  className="w-full px-3 py-1.5 bg-resonance-bg-tertiary border border-resonance-border rounded-xl text-sm text-resonance-text-primary focus:outline-none focus:ring-2 focus:ring-resonance-accent/30 focus:border-resonance-accent transition-all"
                  data-canvas-input="true"
                >
                  {safeCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* ── PERFORMANCE ── */}
          {activeTab === 'performance' && (
            <div className="space-y-5">
              <div>
                <h5 className="text-[10px] font-semibold text-resonance-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Gauge size={12} />
                  Capacity
                </h5>
                <div className="space-y-3">
                  <NumberField
                    label="Max Throughput (RPS)"
                    value={behavioralModel.capacity?.maxThroughput ?? 1000}
                    onChange={(v) => handleBehavioralChange('capacity', 'maxThroughput', v)}
                    min={1}
                    max={1000000}
                    dataProperty="maxThroughput"
                    validationResult={fieldValidation.maxThroughput}
                    onValidate={(v) => validateField('maxThroughput', v)}
                  />
                  <NumberField
                    label="Max Concurrent"
                    value={behavioralModel.capacity?.maxConcurrent ?? 100}
                    onChange={(v) => handleBehavioralChange('capacity', 'maxConcurrent', v)}
                    min={1}
                    max={100000}
                    dataProperty="maxConcurrent"
                    validationResult={fieldValidation.maxConcurrent}
                    onValidate={(v) => validateField('maxConcurrent', v)}
                  />
                  <NumberField
                    label="Max Queue Depth"
                    value={behavioralModel.capacity?.maxQueueDepth ?? 1000}
                    onChange={(v) => handleBehavioralChange('capacity', 'maxQueueDepth', v)}
                    min={0}
                    max={1000000}
                    dataProperty="maxQueueDepth"
                    validationResult={fieldValidation.maxQueueDepth}
                    onValidate={(v) => validateField('maxQueueDepth', v)}
                  />
                  {data.type === 'database' && (
                    <NumberField
                      label="Max Connections"
                      value={behavioralModel.capacity?.maxConnections ?? 100}
                      onChange={(v) => handleBehavioralChange('capacity', 'maxConnections', v)}
                      min={1}
                      max={10000}
                      dataProperty="maxConnections"
                      validationResult={fieldValidation.maxConnections}
                      onValidate={(v) => validateField('maxConnections', v)}
                    />
                  )}
                </div>
              </div>

              <div>
                <h5 className="text-[10px] font-semibold text-resonance-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Clock size={12} />
                  Latency
                </h5>
                <div className="space-y-3">
                  <NumberField
                    label="Base Latency (ms)"
                    value={behavioralModel.latency?.baseLatencyMs ?? 10}
                    onChange={(v) => handleBehavioralChange('latency', 'baseLatencyMs', v)}
                    min={0}
                    max={10000}
                    step={0.1}
                    dataProperty="baseLatencyMs"
                    validationResult={fieldValidation.baseLatencyMs}
                    onValidate={(v) => validateField('baseLatencyMs', v)}
                  />
                  <NumberField
                    label="Std Dev (ms)"
                    value={behavioralModel.latency?.latencyStdDevMs ?? 1}
                    onChange={(v) => handleBehavioralChange('latency', 'latencyStdDevMs', v)}
                    min={0}
                    max={1000}
                    step={0.1}
                    dataProperty="latencyStdDevMs"
                    validationResult={fieldValidation.latencyStdDevMs}
                    onValidate={(v) => validateField('latencyStdDevMs', v)}
                  />
                  <NumberField
                    label="Queue Latency (ms)"
                    value={behavioralModel.latency?.queueLatencyMs ?? 0}
                    onChange={(v) => handleBehavioralChange('latency', 'queueLatencyMs', v)}
                    min={0}
                    max={10000}
                    step={0.1}
                    dataProperty="queueLatencyMs"
                    validationResult={fieldValidation.queueLatencyMs}
                    onValidate={(v) => validateField('queueLatencyMs', v)}
                  />
                  {data.type === 'cache' && (
                    <>
                      <NumberField
                        label="Cache Hit Latency (ms)"
                        value={behavioralModel.latency?.cacheHitLatencyMs ?? 0.5}
                        onChange={(v) => handleBehavioralChange('latency', 'cacheHitLatencyMs', v)}
                        min={0}
                        max={100}
                        step={0.1}
                        dataProperty="cacheHitLatencyMs"
                        validationResult={fieldValidation.cacheHitLatencyMs}
                        onValidate={(v) => validateField('cacheHitLatencyMs', v)}
                      />
                      <NumberField
                        label="Cache Miss Latency (ms)"
                        value={behavioralModel.latency?.cacheMissLatencyMs ?? 15}
                        onChange={(v) => handleBehavioralChange('latency', 'cacheMissLatencyMs', v)}
                        min={0}
                        max={10000}
                        step={0.1}
                        dataProperty="cacheMissLatencyMs"
                        validationResult={fieldValidation.cacheMissLatencyMs}
                        onValidate={(v) => validateField('cacheMissLatencyMs', v)}
                      />
                      <NumberField
                        label="Cache Hit Rate"
                        value={behavioralModel.latency?.cacheHitRate ?? 0.85}
                        onChange={(v) => handleBehavioralChange('latency', 'cacheHitRate', v)}
                        min={0}
                        max={1}
                        step={0.01}
                        dataProperty="cacheHitRate"
                        validationResult={fieldValidation.cacheHitRate}
                        onValidate={(v) => validateField('cacheHitRate', v)}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── RELIABILITY ── */}
          {activeTab === 'reliability' && (
            <div className="space-y-5">
              <div>
                <h5 className="text-[10px] font-semibold text-resonance-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <AlertTriangle size={12} />
                  Error Characteristics
                </h5>
                <div className="space-y-3">
                  <NumberField
                    label="Base Error Rate"
                    value={behavioralModel.errorCharacteristics?.baseErrorRate ?? 0.001}
                    onChange={(v) => handleBehavioralChange('errorCharacteristics', 'baseErrorRate', v)}
                    min={0}
                    max={1}
                    step={0.0001}
                    dataProperty="baseErrorRate"
                    validationResult={fieldValidation.baseErrorRate}
                    onValidate={(v) => validateField('baseErrorRate', v)}
                  />
                  <NumberField
                    label="Error Rate Under Load"
                    value={behavioralModel.errorCharacteristics?.errorRateUnderLoad ?? 0.1}
                    onChange={(v) => handleBehavioralChange('errorCharacteristics', 'errorRateUnderLoad', v)}
                    min={0}
                    max={1}
                    step={0.01}
                    dataProperty="errorRateUnderLoad"
                    validationResult={fieldValidation.errorRateUnderLoad}
                    onValidate={(v) => validateField('errorRateUnderLoad', v)}
                  />
                  <SelectField
                    label="Error Distribution"
                    value={behavioralModel.errorCharacteristics?.errorDistribution || 'uniform'}
                    options={['uniform', 'exponential', 'burst']}
                    onChange={(v) => handleBehavioralChange('errorCharacteristics', 'errorDistribution', v)}
                    dataProperty="errorDistribution"
                    validationResult={fieldValidation.errorDistribution}
                    onValidate={(v) => validateField('errorDistribution', v)}
                  />
                </div>
              </div>

              <div>
                <h5 className="text-[10px] font-semibold text-resonance-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Shield size={12} />
                  Availability
                </h5>
                <div className="space-y-3">
                  <NumberField
                    label="SLA Target (%)"
                    value={(behavioralModel.availability?.slaTarget ?? 0.999) * 100}
                    onChange={(v) => handleBehavioralChange('availability', 'slaTarget', v / 100)}
                    min={0}
                    max={100}
                    step={0.001}
                    dataProperty="slaTarget"
                    validationResult={fieldValidation.slaTarget}
                    onValidate={(v) => validateField('slaTarget', v / 100)}
                  />
                  <NumberField
                    label="MTTR (minutes)"
                    value={behavioralModel.availability?.mttrMinutes ?? 5}
                    onChange={(v) => handleBehavioralChange('availability', 'mttrMinutes', v)}
                    min={0}
                    max={10080}
                    dataProperty="mttrMinutes"
                    validationResult={fieldValidation.mttrMinutes}
                    onValidate={(v) => validateField('mttrMinutes', v)}
                  />
                  <NumberField
                    label="MTBF (hours)"
                    value={behavioralModel.availability?.mtbfHours ?? 720}
                    onChange={(v) => handleBehavioralChange('availability', 'mtbfHours', v)}
                    min={1}
                    max={87600}
                    dataProperty="mtbfHours"
                    validationResult={fieldValidation.mtbfHours}
                    onValidate={(v) => validateField('mtbfHours', v)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── RESOURCES ── */}
          {activeTab === 'resources' && (
            <div className="space-y-3">
              <NumberField
                label="CPU per Request (ms)"
                value={behavioralModel.resourceConsumption?.cpuPerRequest ?? 1}
                onChange={(v) => handleBehavioralChange('resourceConsumption', 'cpuPerRequest', v)}
                min={0}
                max={10000}
                step={0.1}
                dataProperty="cpuPerRequest"
                validationResult={fieldValidation.cpuPerRequest}
                onValidate={(v) => validateField('cpuPerRequest', v)}
              />
              <NumberField
                label="Memory per Connection (bytes)"
                value={behavioralModel.resourceConsumption?.memoryPerConnection ?? 1024}
                onChange={(v) => handleBehavioralChange('resourceConsumption', 'memoryPerConnection', v)}
                min={0}
                max={1000000000}
                dataProperty="memoryPerConnection"
                validationResult={fieldValidation.memoryPerConnection}
                onValidate={(v) => validateField('memoryPerConnection', v)}
              />
              <NumberField
                label="Thread Pool Size"
                value={behavioralModel.resourceConsumption?.threadPoolSize ?? 50}
                onChange={(v) => handleBehavioralChange('resourceConsumption', 'threadPoolSize', v)}
                min={1}
                max={10000}
                dataProperty="threadPoolSize"
                validationResult={fieldValidation.threadPoolSize}
                onValidate={(v) => validateField('threadPoolSize', v)}
              />
              <NumberField
                label="Connection Pool Size"
                value={behavioralModel.resourceConsumption?.connectionPoolSize ?? 100}
                onChange={(v) => handleBehavioralChange('resourceConsumption', 'connectionPoolSize', v)}
                min={1}
                max={100000}
                dataProperty="connectionPoolSize"
                validationResult={fieldValidation.connectionPoolSize}
                onValidate={(v) => validateField('connectionPoolSize', v)}
              />
            </div>
          )}

          {/* ── SCALING ── */}
          {activeTab === 'scaling' && (
            <div className="space-y-3">
              <SelectField
                label="Scaling Type"
                value={behavioralModel.scalingBehavior?.type || 'none'}
                options={['none', 'horizontal', 'vertical', 'auto']}
                onChange={(v) => handleBehavioralChange('scalingBehavior', 'type', v)}
                dataProperty="scalingType"
                validationResult={fieldValidation.scalingType}
                onValidate={(v) => validateField('scalingType', v)}
              />
              {behavioralModel.scalingBehavior?.type !== 'none' && (
                <>
                  <NumberField
                    label="Scale Up Threshold (%)"
                    value={(behavioralModel.scalingBehavior?.scaleUpThreshold ?? 0.8) * 100}
                    onChange={(v) => handleBehavioralChange('scalingBehavior', 'scaleUpThreshold', v / 100)}
                    min={0}
                    max={100}
                    dataProperty="scaleUpThreshold"
                    validationResult={fieldValidation.scaleUpThreshold}
                    onValidate={(v) => validateField('scaleUpThreshold', v / 100)}
                  />
                  <NumberField
                    label="Scale Down Threshold (%)"
                    value={(behavioralModel.scalingBehavior?.scaleDownThreshold ?? 0.3) * 100}
                    onChange={(v) => handleBehavioralChange('scalingBehavior', 'scaleDownThreshold', v / 100)}
                    min={0}
                    max={100}
                    dataProperty="scaleDownThreshold"
                    validationResult={fieldValidation.scaleDownThreshold}
                    onValidate={(v) => validateField('scaleDownThreshold', v / 100)}
                  />
                  <NumberField
                    label="Min Replicas"
                    value={behavioralModel.scalingBehavior?.minReplicas ?? 1}
                    onChange={(v) => handleBehavioralChange('scalingBehavior', 'minReplicas', v)}
                    min={1}
                    max={1000}
                    dataProperty="minReplicas"
                    validationResult={fieldValidation.minReplicas}
                    onValidate={(v) => validateField('minReplicas', v)}
                  />
                  <NumberField
                    label="Max Replicas"
                    value={behavioralModel.scalingBehavior?.maxReplicas ?? 10}
                    onChange={(v) => handleBehavioralChange('scalingBehavior', 'maxReplicas', v)}
                    min={1}
                    max={10000}
                    dataProperty="maxReplicas"
                    validationResult={fieldValidation.maxReplicas}
                    onValidate={(v) => validateField('maxReplicas', v)}
                  />
                </>
              )}
            </div>
          )}

          {/* ── COST ── */}
          {activeTab === 'cost' && (
            <div className="space-y-3">
              <NumberField
                label="Hourly Compute Cost ($)"
                value={behavioralModel.costProfile?.hourlyComputeCost ?? 0}
                onChange={(v) => handleBehavioralChange('costProfile', 'hourlyComputeCost', v)}
                min={0}
                max={1000}
                step={0.001}
                dataProperty="hourlyComputeCost"
                validationResult={fieldValidation.hourlyComputeCost}
                onValidate={(v) => validateField('hourlyComputeCost', v)}
              />
              <NumberField
                label="Per Request Cost ($)"
                value={behavioralModel.costProfile?.perRequestCost ?? 0}
                onChange={(v) => handleBehavioralChange('costProfile', 'perRequestCost', v)}
                min={0}
                max={1}
                step={0.000001}
                dataProperty="perRequestCost"
                validationResult={fieldValidation.perRequestCost}
                onValidate={(v) => validateField('perRequestCost', v)}
              />
              <NumberField
                label="Per GB Network Cost ($)"
                value={behavioralModel.costProfile?.perGbNetworkCost ?? 0.09}
                onChange={(v) => handleBehavioralChange('costProfile', 'perGbNetworkCost', v)}
                min={0}
                max={10}
                step={0.001}
                dataProperty="perGbNetworkCost"
                validationResult={fieldValidation.perGbNetworkCost}
                onValidate={(v) => validateField('perGbNetworkCost', v)}
              />
            </div>
          )}

          {/* ── CUSTOM ── */}
          {activeTab === 'custom' && (
            <div className="space-y-3">
              {genericConfig.map(([key, value]) => (
                <div key={key} className="group" data-property={key}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-resonance-text-muted capitalize">{key.replace(/-/g, ' ')}</label>
                    <button
                      onClick={() => handleRemoveConfigField(key)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded-lg hover:bg-red-500/10 text-red-500 transition-all"
                      title="Remove field"
                    >
                      <X size={10} />
                    </button>
                  </div>
                  <ConfigInput
                    value={value}
                    onChange={(v) => handleConfigChange(key, v)}
                    dataProperty={key}
                    validationResult={fieldValidation[key]}
                    onValidate={(v) => validateField(key, v)}
                  />
                </div>
              ))}

              {hiddenDecorativeCount > 0 && (
                <p className="text-[10px] text-resonance-text-muted italic">
                  {hiddenDecorativeCount} decorative field{hiddenDecorativeCount > 1 ? 's' : ''} hidden
                </p>
              )}

              {showAddConfig ? (
                <div className="mt-3 p-2 bg-resonance-bg-tertiary rounded-xl border border-resonance-border">
                  <input
                    type="text"
                    placeholder="Field name"
                    value={newConfigKey}
                    onChange={(e) => setNewConfigKey(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && newConfigKey.trim() && document.getElementById('config-value-input')?.focus()}
                    className="w-full px-2 py-1 bg-resonance-bg-secondary border border-resonance-border rounded-lg text-xs text-resonance-text-primary placeholder-resonance-text-muted focus:outline-none focus:border-resonance-accent mb-1.5"
                    autoFocus
                    data-canvas-input="true"
                  />
                  <input
                    id="config-value-input"
                    type="text"
                    placeholder="Value"
                    value={newConfigValue}
                    onChange={(e) => setNewConfigValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddConfigField()}
                    className="w-full px-2 py-1 bg-resonance-bg-secondary border border-resonance-border rounded-lg text-xs text-resonance-text-primary placeholder-resonance-text-muted focus:outline-none focus:border-resonance-accent mb-1.5"
                    data-canvas-input="true"
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={handleAddConfigField}
                      disabled={!newConfigKey.trim() || DECORATIVE_PROPS.has(newConfigKey.trim())}
                      className="flex-1 px-2 py-1 rounded-lg bg-resonance-accent text-resonance-neutral text-[10px] font-medium hover:bg-resonance-accent-hover disabled:opacity-40 transition-colors"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => { setShowAddConfig(false); setNewConfigKey(''); setNewConfigValue('') }}
                      className="px-2 py-1 rounded-lg bg-resonance-bg-hover text-resonance-text-secondary text-[10px] hover:text-resonance-text-primary transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddConfig(true)}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-resonance-border text-xs text-resonance-text-muted hover:text-resonance-text-secondary hover:border-resonance-text-secondary transition-all"
                >
                  <Copy size={12} />
                  Add Custom Field
                </button>
              )}
            </div>
          )}
        </div>

        {/* Simulation Metrics (read-only) */}
        {data.metrics && (
          <div className="p-4 border-t border-resonance-border">
            <h4 className="text-xs font-semibold text-resonance-text-secondary uppercase tracking-wider mb-3">
              Last Simulation Metrics
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
})

PropertyPanel.displayName = 'PropertyPanel'

// ============================================================================
// EDGE PROPERTY PANEL
// ============================================================================

const EdgePropertyPanel = ({ edge, onUpdate, onRemove, onClose, allTypes }) => {
  const data = edge.data || {}
  const meta = CONNECTION_TYPE_META[data.connectionType] || CONNECTION_TYPE_META['http'] || { label: 'HTTP', color: '#3b82f6' }
  const edgeBehavioral = data.behavioralModel || getConnectionBehavioralModel(data.connectionType) || {}

  const [edgeExpandedSections, setEdgeExpandedSections] = useState({
    transport: false,
    network: false,
    reliability: false,
    throughput: false,
  })

  const toggleEdgeSection = (section) => {
    setEdgeExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const handleTypeChange = (typeId) => {
    const newBehavioral = getConnectionBehavioralModel(typeId)
    onUpdate(edge.id, {
      connectionType: typeId,
      behavioralModel: newBehavioral,
    })
  }

  const handleBehavioralChange = (section, key, value) => {
    onUpdate(edge.id, {
      behavioralModel: {
        ...edgeBehavioral,
        [section]: {
          ...edgeBehavioral[section],
          [key]: value,
        },
      },
    })
  }

  const handleLabelChange = (label) => {
    onUpdate(edge.id, { label })
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Connection Type */}
      <div>
        <label className="text-xs text-resonance-text-muted mb-1.5 block">Connection Type</label>
        <div className="space-y-1">
          {(allTypes || []).map(type => {
            const typeMeta = CONNECTION_TYPE_META[type.id] || { color: type.color, label: type.label }
            return (
              <button
                key={type.id}
                onClick={() => handleTypeChange(type.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all ${
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

      {/* Label */}
      <div>
        <label className="text-xs text-resonance-text-muted mb-1.5 block">Label</label>
        <input
          type="text"
          value={data.label || ''}
          onChange={(e) => handleLabelChange(e.target.value)}
          placeholder="Optional label..."
          className="w-full px-3 py-1.5 bg-resonance-bg-tertiary border border-resonance-border rounded-xl text-sm text-resonance-text-primary placeholder-resonance-text-muted focus:outline-none focus:ring-2 focus:ring-resonance-accent/30 focus:border-resonance-accent transition-all"
          data-canvas-input="true"
        />
      </div>

      {/* Edge Behavioral Model */}
      <div>
        <h4 className="text-xs font-semibold text-resonance-text-secondary uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Network size={12} />
          Connection Model
        </h4>

        <EdgeBehavioralSection
          title="Transport"
          icon={Server}
          expanded={edgeExpandedSections.transport}
          onToggle={() => toggleEdgeSection('transport')}
        >
          <SelectField
            label="Type"
            value={edgeBehavioral.transport?.type || 'tcp'}
            options={['tcp', 'udp', 'quic', 'tls', 'plaintext']}
            onChange={(v) => handleBehavioralChange('transport', 'type', v)}
            dataProperty="transportType"
          />
          <NumberField
            label="Handshake (ms)"
            value={edgeBehavioral.transport?.handshakeMs ?? 30}
            onChange={(v) => handleBehavioralChange('transport', 'handshakeMs', v)}
            min={0}
            max={10000}
            dataProperty="handshakeMs"
          />
        </EdgeBehavioralSection>

        <EdgeBehavioralSection
          title="Network"
          icon={Network}
          expanded={edgeExpandedSections.network}
          onToggle={() => toggleEdgeSection('network')}
        >
          <NumberField
            label="Base Latency (ms)"
            value={edgeBehavioral.network?.baseLatencyMs ?? 10}
            onChange={(v) => handleBehavioralChange('network', 'baseLatencyMs', v)}
            min={0}
            max={10000}
            dataProperty="baseLatencyMs"
          />
          <NumberField
            label="Jitter (ms)"
            value={edgeBehavioral.network?.jitterMs ?? 2}
            onChange={(v) => handleBehavioralChange('network', 'jitterMs', v)}
            min={0}
            max={1000}
            dataProperty="jitterMs"
          />
          <NumberField
            label="Packet Loss Rate"
            value={edgeBehavioral.network?.packetLossRate ?? 0.0001}
            onChange={(v) => handleBehavioralChange('network', 'packetLossRate', v)}
            min={0}
            max={1}
            step={0.0001}
            dataProperty="packetLossRate"
          />
        </EdgeBehavioralSection>

        <EdgeBehavioralSection
          title="Reliability"
          icon={Shield}
          expanded={edgeExpandedSections.reliability}
          onToggle={() => toggleEdgeSection('reliability')}
        >
          <NumberField
            label="Max Retries"
            value={edgeBehavioral.reliability?.maxRetries ?? 3}
            onChange={(v) => handleBehavioralChange('reliability', 'maxRetries', v)}
            min={0}
            max={10}
            dataProperty="maxRetries"
          />
          <NumberField
            label="Timeout (ms)"
            value={edgeBehavioral.reliability?.timeoutMs ?? 30000}
            onChange={(v) => handleBehavioralChange('reliability', 'timeoutMs', v)}
            min={0}
            max={300000}
            dataProperty="timeoutMs"
          />
          <SelectField
            label="Circuit Breaker"
            value={edgeBehavioral.reliability?.circuitBreakerEnabled ? 'enabled' : 'disabled'}
            options={['enabled', 'disabled']}
            onChange={(v) => handleBehavioralChange('reliability', 'circuitBreakerEnabled', v === 'enabled')}
            dataProperty="circuitBreakerEnabled"
          />
        </EdgeBehavioralSection>

        <EdgeBehavioralSection
          title="Throughput"
          icon={Gauge}
          expanded={edgeExpandedSections.throughput}
          onToggle={() => toggleEdgeSection('throughput')}
        >
          <NumberField
            label="Max RPS"
            value={edgeBehavioral.throughput?.maxRps ?? 10000}
            onChange={(v) => handleBehavioralChange('throughput', 'maxRps', v)}
            min={1}
            max={1000000}
            dataProperty="maxRps"
          />
          <NumberField
            label="Max Concurrent"
            value={edgeBehavioral.throughput?.maxConcurrent ?? 1000}
            onChange={(v) => handleBehavioralChange('throughput', 'maxConcurrent', v)}
            min={1}
            max={100000}
            dataProperty="maxConcurrent"
          />
        </EdgeBehavioralSection>
      </div>

      {/* From → To */}
      <div className="p-3 bg-resonance-bg-tertiary rounded-xl border border-resonance-border">
        <p className="text-xs text-resonance-text-muted mb-1">From → To</p>
        <p className="text-sm text-resonance-text-secondary font-mono">{edge.source}</p>
        <p className="text-sm text-resonance-text-secondary font-mono">{edge.target}</p>
      </div>

      <button
        onClick={() => { onRemove(edge.id); onClose() }}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 text-red-500 text-xs font-medium hover:bg-red-500/20 transition-colors"
      >
        <Trash2 size={12} />
        Delete Edge
      </button>
    </div>
  )
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const NumberField = ({ label, value, onChange, min = 0, max = 1000000, step = 1, dataProperty, validationResult, onValidate }) => {
  const [localValue, setLocalValue] = useState(value)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const handleBlur = () => {
    const num = parseFloat(localValue)
    if (!isNaN(num)) {
      const clamped = Math.max(min, Math.min(max, num))
      onChange(clamped)
      onValidate?.(clamped)
    } else {
      setLocalValue(value)
    }
  }

  const borderClass = validationResult
    ? validationResult.valid
      ? 'border-green-500/50 focus:border-green-500 focus:ring-green-500/20'
      : 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
    : 'border-resonance-border focus:border-resonance-accent focus:ring-resonance-accent/30'

  return (
    <div data-property={dataProperty} className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs text-resonance-text-muted">{label}</label>
        {validationResult && !validationResult.valid && (
          <span className="text-[10px] text-red-500 font-medium" title={validationResult.message}>Invalid</span>
        )}
      </div>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        className={`w-full px-2.5 py-1.5 bg-resonance-bg-tertiary rounded-xl text-xs text-resonance-text-primary focus:outline-none focus:ring-2 transition-all ${borderClass}`}
        data-canvas-input="true"
      />
      {validationResult && !validationResult.valid && (
        <p className="text-[10px] text-red-500 leading-tight">{validationResult.message}</p>
      )}
    </div>
  )
}

const SelectField = ({ label, value, options, onChange, dataProperty, validationResult, onValidate }) => {
  const handleChange = (e) => {
    const newValue = e.target.value
    onChange(newValue)
    onValidate?.(newValue)
  }

  const borderClass = validationResult
    ? validationResult.valid
      ? 'border-green-500/50 focus:border-green-500 focus:ring-green-500/20'
      : 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
    : 'border-resonance-border focus:border-resonance-accent focus:ring-resonance-accent/30'

  return (
    <div data-property={dataProperty} className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs text-resonance-text-muted mb-1 block">{label}</label>
        {validationResult && !validationResult.valid && (
          <span className="text-[10px] text-red-500 font-medium" title={validationResult.message}>Invalid</span>
        )}
      </div>
      <select
        value={value}
        onChange={handleChange}
        className={`w-full px-2.5 py-1.5 bg-resonance-bg-tertiary rounded-xl text-xs text-resonance-text-primary focus:outline-none focus:ring-2 transition-all ${borderClass}`}
        data-canvas-input="true"
      >
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      {validationResult && !validationResult.valid && (
        <p className="text-[10px] text-red-500 leading-tight">{validationResult.message}</p>
      )}
    </div>
  )
}

const ConfigInput = ({ value, onChange, dataProperty, validationResult, onValidate }) => {
  if (typeof value === 'boolean') {
    return (
      <div data-property={dataProperty} className="flex items-center justify-between">
        <label className="text-xs text-resonance-text-muted capitalize">{dataProperty.replace(/-/g, ' ')}</label>
        <button
          onClick={() => {
            const newValue = !value
            onChange(newValue)
            onValidate?.(newValue)
          }}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            value ? 'bg-resonance-accent' : 'bg-resonance-bg-tertiary border border-resonance-border'
          }`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
            value ? 'translate-x-5' : 'translate-x-0.5'
          }`} />
        </button>
      </div>
    )
  }

  if (typeof value === 'number') {
    const [localValue, setLocalValue] = useState(value)
    useEffect(() => setLocalValue(value), [value])

    const borderClass = validationResult
      ? validationResult.valid
        ? 'border-green-500/50 focus:border-green-500 focus:ring-green-500/20'
        : 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
      : 'border-resonance-border focus:border-resonance-accent focus:ring-resonance-accent/30'

    return (
      <div data-property={dataProperty} className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-xs text-resonance-text-muted capitalize">{dataProperty.replace(/-/g, ' ')}</label>
          {validationResult && !validationResult.valid && (
            <span className="text-[10px] text-red-500 font-medium">Invalid</span>
          )}
        </div>
        <input
          type="number"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={() => {
            const num = parseFloat(localValue)
            if (!isNaN(num)) {
              onChange(num)
              onValidate?.(num)
            } else {
              setLocalValue(value)
            }
          }}
          className={`w-full px-3 py-1.5 bg-resonance-bg-tertiary rounded-xl text-sm text-resonance-text-primary focus:outline-none focus:ring-2 transition-all ${borderClass}`}
          data-canvas-input="true"
        />
        {validationResult && !validationResult.valid && (
          <p className="text-[10px] text-red-500 leading-tight">{validationResult.message}</p>
        )}
      </div>
    )
  }

  const borderClass = validationResult
    ? validationResult.valid
      ? 'border-green-500/50 focus:border-green-500 focus:ring-green-500/20'
      : 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
    : 'border-resonance-border focus:border-resonance-accent focus:ring-resonance-accent/30'

  return (
    <div data-property={dataProperty} className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs text-resonance-text-muted capitalize">{dataProperty.replace(/-/g, ' ')}</label>
        {validationResult && !validationResult.valid && (
          <span className="text-[10px] text-red-500 font-medium">Invalid</span>
        )}
      </div>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => onValidate?.(value)}
        className={`w-full px-3 py-1.5 bg-resonance-bg-tertiary rounded-xl text-sm text-resonance-text-primary placeholder-resonance-text-muted focus:outline-none focus:ring-2 transition-all ${borderClass}`}
        data-canvas-input="true"
      />
      {validationResult && !validationResult.valid && (
        <p className="text-[10px] text-red-500 leading-tight">{validationResult.message}</p>
      )}
    </div>
  )
}

const EdgeBehavioralSection = ({ title, icon: Icon, expanded, onToggle, children }) => {
  return (
    <div className="border border-resonance-border rounded-xl overflow-hidden mb-2">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 bg-resonance-bg-tertiary hover:bg-resonance-bg-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-resonance-text-muted" />
          <span className="text-xs font-medium text-resonance-text-secondary">{title}</span>
        </div>
        {expanded ? <span className="text-xs text-resonance-text-muted">−</span> : <span className="text-xs text-resonance-text-muted">+</span>}
      </button>
      {expanded && (
        <div className="p-3 space-y-3 bg-resonance-bg-panel">
          {children}
        </div>
      )}
    </div>
  )
}

const MetricRow = ({ label, value, color = 'text-resonance-text-primary' }) => (
  <div className="flex items-center justify-between py-1">
    <span className="text-xs text-resonance-text-muted">{label}</span>
    <span className={`text-xs font-mono font-medium ${color}`}>{value}</span>
  </div>
)