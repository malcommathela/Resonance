import { create } from 'zustand'
import {
  BLOCK_TYPES,
  CONNECTION_TYPES,
  CONNECTION_TYPE_META,
  categories,
  SIMULATION_BLOCK_TYPES,
  SIMULATION_CONNECTION_TYPES,
  getBlockBehavioralModel,
  getConnectionBehavioralModel,
} from '@shared/constants'

const GRID_SIZE = 20

function snapToGrid(value) {
  return Math.round(value / GRID_SIZE) * GRID_SIZE
}

// ============================================================================
// PANEL STATE PERSISTENCE
// ============================================================================
const PANEL_STORAGE_KEY = 'resonance.canvas.panels'

const defaultPanels = {
  blockLibrary: { collapsed: false, width: 280 },
  validation: { collapsed: false, width: 280 },
  properties: { collapsed: false, width: 320 },
}

function loadPanelState() {
  try {
    const raw = localStorage.getItem(PANEL_STORAGE_KEY)
    if (!raw) return defaultPanels
    const parsed = JSON.parse(raw)
    return {
      blockLibrary: { ...defaultPanels.blockLibrary, ...parsed.blockLibrary },
      validation: { ...defaultPanels.validation, ...parsed.validation },
      properties: { ...defaultPanels.properties, ...parsed.properties },
    }
  } catch {
    return defaultPanels
  }
}

function savePanelState(panels) {
  try {
    localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(panels))
  } catch {
    // Ignore localStorage errors (e.g., private mode)
  }
}

// ============================================================================
// BATCH A: DECORATIVE PROPERTY CLEANUP
// ============================================================================

export function stripDecorativeProps(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return config
  const cleaned = {}
  for (const [key, value] of Object.entries(config)) {
    if (key === 'behavioralModel') {
      cleaned[key] = value
    } else if (!DECORATIVE_PROPS.has(key)) {
      cleaned[key] = value
    }
  }
  return cleaned
}

function getDefaultConfig(type) {
  const simDef = SIMULATION_BLOCK_TYPES[type]
  const uiDefaults = stripDecorativeProps(simDef?.defaultConfig) || {}
  const behavioral = simDef?.behavioralModel || {}

  return {
    ...uiDefaults,
    behavioralModel: behavioral,
  }
}

function getDefaultEdgeConfig(connectionType) {
  const simDef = SIMULATION_CONNECTION_TYPES[connectionType]
  const meta = CONNECTION_TYPE_META[connectionType] || CONNECTION_TYPE_META['http']
  const behavioral = simDef?.behavioralModel || {}

  return {
    connectionType,
    label: meta.label,
    color: meta.color,
    icon: meta.icon,
    description: meta.description,
    behavioralModel: behavioral,
  }
}

export const useCanvasStore = create((set, get) => ({
  nodes: [],
  edges: [],

  selectedNodeId: null,
  selectedEdgeId: null,
  selectedNodeIds: [],
  selectedEdgeIds: [],
  selectedNode: null,
  selectedNodes: [],
  selectedEdge: null,
  selectedEdges: [],
  validationHighlight: null,
  panels: loadPanelState(),
  simulationStatus: 'idle',
  simulationProgress: 0,
  simulationReportId: null,
  simulationAutoOpenReport: false,
  simulationErrorMessage: null,
  simulationRunning: false,
  simulationMetrics: null,
  activeTab: 'editor',
  zoom: 1,
  validationResult: null,
  isValidating: false,
  highlightedBlockId: null,
  showValidationPanel: false,
  simulationBlockMetrics: {},
  simulationEdgeMetrics: {},
  simulationAlerts: [],
  simulationConfig: null,
  customBlockTypes: [],
  customEdgeTypes: [],
  history: [],
  historyIndex: -1,
  maxHistorySize: 50,

  // ==========================================================================
  // SELECTION ACTIONS
  // ==========================================================================

  selectNode: (nodeId) => {
    const { nodes } = get()
    const node = nodes.find(n => n.id === nodeId) || null
    set({
      selectedNodeId: nodeId,
      selectedEdgeId: null,
      selectedNodeIds: nodeId ? [nodeId] : [],
      selectedEdgeIds: [],
      selectedNode: node,
      selectedNodes: node ? [node] : [],
      selectedEdge: null,
      selectedEdges: [],
      validationHighlight: null,
    })
  },

  selectEdge: (edgeId) => {
    const { edges } = get()
    const edge = edges.find(e => e.id === edgeId) || null
    set({
      selectedNodeId: null,
      selectedEdgeId: edgeId,
      selectedNodeIds: [],
      selectedEdgeIds: edgeId ? [edgeId] : [],
      selectedNode: null,
      selectedNodes: [],
      selectedEdge: edge,
      selectedEdges: edge ? [edge] : [],
      validationHighlight: null,
    })
  },

  clearSelection: () => set({
    selectedNodeId: null,
    selectedEdgeId: null,
    selectedNodeIds: [],
    selectedEdgeIds: [],
    selectedNode: null,
    selectedNodes: [],
    selectedEdge: null,
    selectedEdges: [],
  }),

  // ==========================================================================
  // VALIDATION HIGHLIGHT ACTIONS
  // ==========================================================================

  setValidationHighlight: (finding) => {
    if (!finding) {
      set({ validationHighlight: null, highlightedBlockId: null })
      return
    }
    const elementId = finding.elementId || finding.blockId || finding.edgeId
    const elementType = finding.elementType || (finding.blockId ? 'node' : finding.edgeId ? 'edge' : 'node')
    set({
      validationHighlight: {
        elementId,
        elementType,
        findingId: finding.id,
        severity: finding.severity,
      },
      highlightedBlockId: elementType === 'node' ? elementId : null,
    })
  },

  clearValidationHighlight: () => set({
    validationHighlight: null,
    highlightedBlockId: null,
  }),

  // ==========================================================================
  // PANEL ACTIONS
  // ==========================================================================

  togglePanel: (panel) => {
    const { panels } = get()
    const next = {
      ...panels,
      [panel]: { ...panels[panel], collapsed: !panels[panel].collapsed },
    }
    savePanelState(next)
    set({ panels: next })
  },

  setPanelWidth: (panel, width) => {
    const { panels } = get()
    const next = {
      ...panels,
      [panel]: { ...panels[panel], width: Math.max(180, Math.min(480, width)) },
    }
    savePanelState(next)
    set({ panels: next })
  },

  resetPanels: () => {
    savePanelState(defaultPanels)
    set({ panels: defaultPanels })
  },

  // ==========================================================================
  // SIMULATION AUTO-REPORT ACTIONS
  // ==========================================================================

  startSimulation: () => set({
    simulationRunning: true,
    simulationMetrics: null,
    simulationBlockMetrics: {},
    simulationEdgeMetrics: {},
    simulationAlerts: [],
    simulationConfig: null,
    simulationStatus: 'running',
    simulationProgress: 0,
    simulationReportId: null,
    simulationAutoOpenReport: false,
    simulationErrorMessage: null,
  }),

  stopSimulation: () => set({
    simulationRunning: false,
    simulationStatus: 'stopped',
  }),

  setSimulationComplete: (reportId, autoOpen = true) => set({
    simulationRunning: false,
    simulationStatus: 'completed',
    simulationReportId: reportId,
    simulationAutoOpenReport: autoOpen,
    simulationErrorMessage: null,
  }),

  setSimulationFailed: (errorMessage) => set({
    simulationRunning: false,
    simulationStatus: 'failed',
    simulationErrorMessage: errorMessage,
    simulationAutoOpenReport: false,
  }),

  setSimulationProgress: (progress) => set({
    simulationProgress: progress,
  }),

  resetSimulation: () => set({
    simulationRunning: false,
    simulationMetrics: null,
    simulationBlockMetrics: {},
    simulationEdgeMetrics: {},
    simulationAlerts: [],
    simulationConfig: null,
    simulationStatus: 'idle',
    simulationProgress: 0,
    simulationReportId: null,
    simulationAutoOpenReport: false,
    simulationErrorMessage: null,
  }),

  acknowledgeAutoReport: () => set({ simulationAutoOpenReport: false }),

  // ==========================================================================
  // SAVE / EXPORT HELPERS
  // ==========================================================================

  /**
   * FIX: Prepare the current canvas state for API persistence.
   *
   * - Nodes keep `data.config` (Block schema stores config nested in data)
   * - Edges map `data` → `config` (Edge schema stores rich properties at top level)
   *
   * Any save/autosave hook should use this instead of raw nodes/edges.
   */
  getDesignForSave: () => {
    const { nodes, edges } = get()
    return {
      nodes: nodes.map(node => ({
        ...node,
        data: {
          ...node.data,
          config: stripDecorativeProps(node.data?.config || {}),
        },
      })),
      edges: edges.map(edge => {
        // Extract React Flow data into Prisma config field
        const { data, ...edgeRest } = edge
        return {
          ...edgeRest,
          config: stripDecorativeProps(data || {}),
        }
      }),
    }
  },

  // ==========================================================================
  // HISTORY
  // ==========================================================================

  saveHistory: () => {
    const { nodes, edges, history, historyIndex, maxHistorySize } = get()
    const state = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges))
    }
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(state)
    if (newHistory.length > maxHistorySize) newHistory.shift()
    set({ history: newHistory, historyIndex: newHistory.length - 1 })
  },

  undo: () => {
    const { history, historyIndex } = get()
    if (historyIndex <= 0) return
    const newIndex = historyIndex - 1
    const state = history[newIndex]
    set({
      nodes: JSON.parse(JSON.stringify(state.nodes)),
      edges: JSON.parse(JSON.stringify(state.edges)),
      historyIndex: newIndex,
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectedNode: null,
      selectedNodes: [],
      selectedEdge: null,
      selectedEdges: [],
      validationHighlight: null,
    })
  },

  redo: () => {
    const { history, historyIndex } = get()
    if (historyIndex >= history.length - 1) return
    const newIndex = historyIndex + 1
    const state = history[newIndex]
    set({
      nodes: JSON.parse(JSON.stringify(state.nodes)),
      edges: JSON.parse(JSON.stringify(state.edges)),
      historyIndex: newIndex,
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectedNode: null,
      selectedNodes: [],
      selectedEdge: null,
      selectedEdges: [],
      validationHighlight: null,
    })
  },

  addNode: (type, position, overrides = {}) => {
    get().saveHistory()
    const allTypes = [...BLOCK_TYPES, ...get().customBlockTypes]
    const blockType = allTypes.find(b => b.id === type)

    const defaultConfig = getDefaultConfig(type)

    const mergedConfig = { ...defaultConfig }
    if (overrides.config) {
      const cleanOverrides = stripDecorativeProps(overrides.config)
      for (const key of Object.keys(cleanOverrides)) {
        if (key === 'behavioralModel' && typeof cleanOverrides[key] === 'object') {
          mergedConfig.behavioralModel = deepMerge(mergedConfig.behavioralModel || {}, cleanOverrides[key])
        } else {
          mergedConfig[key] = cleanOverrides[key]
        }
      }
    }

    const newNode = {
      id: `${type}-${Date.now()}`,
      type: 'customBlock',
      position: {
        x: snapToGrid(position.x),
        y: snapToGrid(position.y),
      },
      data: {
        label: overrides.label || blockType?.label || type,
        type: type,
        icon: overrides.icon || blockType?.icon || 'Server',
        color: overrides.color || blockType?.color || '#8b5cf6',
        category: overrides.category || blockType?.category || 'other',
        description: blockType?.description || '',
        config: mergedConfig,
        isCustom: overrides.isCustom || false,
      },
    }
    set({ nodes: [...get().nodes, newNode] })
    return newNode
  },

  duplicateNode: (id) => {
    const node = get().nodes.find(n => n.id === id)
    if (!node) return null
    get().saveHistory()
    const newNode = {
      ...node,
      id: `${node.data?.type || 'block'}-${Date.now()}`,
      position: {
        x: snapToGrid(node.position.x + 40),
        y: snapToGrid(node.position.y + 40),
      },
      data: {
        ...node.data,
        config: stripDecorativeProps(node.data?.config || {}),
      },
    }
    set({ nodes: [...get().nodes, newNode] })
    return newNode
  },

  updateNode: (id, updates) => {
    set({
      nodes: get().nodes.map(n => {
        if (n.id !== id) return n
        const newPosition = updates.position ? {
          x: snapToGrid(updates.position.x),
          y: snapToGrid(updates.position.y),
        } : undefined

        let mergedConfig = n.data.config
        if (updates.config) {
          mergedConfig = { ...n.data.config }
          const cleanUpdates = stripDecorativeProps(updates.config)
          for (const key of Object.keys(cleanUpdates)) {
            if (key === 'behavioralModel' && typeof cleanUpdates[key] === 'object') {
              mergedConfig.behavioralModel = deepMerge(mergedConfig.behavioralModel || {}, cleanUpdates[key])
            } else {
              mergedConfig[key] = cleanUpdates[key]
            }
          }
        }

        return {
          ...n,
          data: {
            ...n.data,
            ...updates,
            config: mergedConfig,
          },
          ...(newPosition && { position: newPosition }),
        }
      })
    })
  },

  updateNodePosition: (id, position) => {
    get().saveHistory()
    set({
      nodes: get().nodes.map(n =>
        n.id === id ? { ...n, position: { x: snapToGrid(position.x), y: snapToGrid(position.y) } } : n
      )
    })
  },

  removeNode: (id) => {
    get().saveHistory()
    const state = get()
    const wasSelected = state.selectedNodeId === id
    const wasInMulti = state.selectedNodeIds.includes(id)
    set({
      nodes: state.nodes.filter(n => n.id !== id),
      edges: state.edges.filter(e => {
        const src = e.source || e.sourceId
        const tgt = e.target || e.targetId
        return src !== id && tgt !== id
      }),
      selectedNodeId: wasSelected ? null : state.selectedNodeId,
      selectedNodeIds: wasInMulti ? state.selectedNodeIds.filter(sid => sid !== id) : state.selectedNodeIds,
      selectedNode: wasSelected ? null : state.selectedNode,
      selectedNodes: state.selectedNodes.filter(n => n.id !== id),
      selectedEdgeId: null,
      selectedEdgeIds: [],
      selectedEdge: null,
      selectedEdges: [],
      validationHighlight: state.validationHighlight?.elementId === id ? null : state.validationHighlight,
      highlightedBlockId: state.highlightedBlockId === id ? null : state.highlightedBlockId,
    })
  },

  addEdge: (edge, type = 'http') => {
    get().saveHistory()
    const src = edge.source || edge.sourceId
    const tgt = edge.target || edge.targetId
    const exists = get().edges.some(
      e => (e.source || e.sourceId) === src && (e.target || e.targetId) === tgt
    )
    if (!exists) {
      const edgeConfig = getDefaultEdgeConfig(type)
      const newEdge = {
        ...edge,
        id: `e-${Date.now()}`,
        type: 'customEdge',
        source: src,
        target: tgt,
        sourceId: src,
        targetId: tgt,
        data: {
          ...edgeConfig,
          ...(edge.data || {}),
        },
      }
      set({ edges: [...get().edges, newEdge] })
      return newEdge
    }
    return null
  },

  removeEdge: (id) => {
    get().saveHistory()
    const state = get()
    const wasSelected = state.selectedEdgeId === id
    const wasInMulti = state.selectedEdgeIds.includes(id)
    set({
      edges: state.edges.filter(e => e.id !== id),
      selectedEdgeId: wasSelected ? null : state.selectedEdgeId,
      selectedEdgeIds: wasInMulti ? state.selectedEdgeIds.filter(seid => seid !== id) : state.selectedEdgeIds,
      selectedEdge: wasSelected ? null : state.selectedEdge,
      selectedEdges: state.selectedEdges.filter(e => e.id !== id),
      validationHighlight: state.validationHighlight?.elementId === id ? null : state.validationHighlight,
    })
  },

  updateEdge: (id, updates) => {
    set({
      edges: get().edges.map(e => {
        if (e.id !== id) return e
        let mergedData = { ...e.data }
        if (updates.data) {
          mergedData = { ...mergedData, ...updates.data }
          if (updates.data.connectionType && updates.data.connectionType !== e.data?.connectionType) {
            const newConfig = getDefaultEdgeConfig(updates.data.connectionType)
            mergedData = { ...newConfig, ...mergedData }
          }
          if (updates.data.behavioralModel && typeof updates.data.behavioralModel === 'object') {
            mergedData.behavioralModel = deepMerge(mergedData.behavioralModel || {}, updates.data.behavioralModel)
          }
        }
        return { ...e, data: mergedData }
      })
    })
  },

  updateEdgeData: (id, dataUpdates) => {
    set({
      edges: get().edges.map(e => {
        if (e.id !== id) return e
        let mergedData = { ...e.data, ...dataUpdates }
        if (dataUpdates.behavioralModel && typeof dataUpdates.behavioralModel === 'object') {
          mergedData.behavioralModel = deepMerge(e.data?.behavioralModel || {}, dataUpdates.behavioralModel)
        }
        return { ...e, data: mergedData }
      })
    })
  },

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  setSelectedNode: (node) => {
    if (node) get().selectNode(node.id)
    else get().clearSelection()
  },
  setSelectedNodes: (nodes) => {
    const ids = nodes.map(n => n.id)
    set({
      selectedNodeIds: ids,
      selectedNodeId: ids[0] || null,
      selectedNode: nodes[0] || null,
      selectedNodes: nodes,
      selectedEdgeId: null,
      selectedEdgeIds: [],
      selectedEdge: null,
      selectedEdges: [],
    })
  },
  setSelectedEdge: (edge) => {
    if (edge) get().selectEdge(edge.id)
    else get().clearSelection()
  },
  setSelectedEdges: (edges) => {
    const ids = edges.map(e => e.id)
    set({
      selectedEdgeIds: ids,
      selectedEdgeId: ids[0] || null,
      selectedEdge: edges[0] || null,
      selectedEdges: edges,
      selectedNodeId: null,
      selectedNodeIds: [],
      selectedNode: null,
      selectedNodes: [],
    })
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setZoom: (zoom) => set({ zoom }),

  setValidationResult: (result) => set({ validationResult: result }),
  setIsValidating: (val) => set({ isValidating: val }),
  setHighlightedBlockId: (id) => set({
    highlightedBlockId: id,
    validationHighlight: id ? { elementId: id, elementType: 'node', findingId: 'legacy', severity: 'warning' } : null,
  }),
  setShowValidationPanel: (show) => set({ showValidationPanel: show }),
  clearValidation: () => set({
    validationResult: null,
    highlightedBlockId: null,
    validationHighlight: null,
  }),

  setSimulationBlockMetrics: (metrics) => set({ simulationBlockMetrics: metrics }),
  setSimulationEdgeMetrics: (metrics) => set({ simulationEdgeMetrics: metrics }),
  setSimulationAlerts: (alerts) => set({ simulationAlerts: alerts }),
  addSimulationAlert: (alert) => set({ simulationAlerts: [...get().simulationAlerts, alert] }),
  setSimulationConfig: (config) => set({ simulationConfig: config }),
  clearSimulationState: () => set({
    simulationMetrics: null,
    simulationBlockMetrics: {},
    simulationEdgeMetrics: {},
    simulationAlerts: [],
    simulationConfig: null,
    simulationStatus: 'idle',
    simulationProgress: 0,
    simulationReportId: null,
    simulationAutoOpenReport: false,
    simulationErrorMessage: null,
  }),

  deleteSelected: () => {
    const { selectedNodeIds, selectedEdgeIds, nodes, edges } = get()
    const nodeIds = new Set(selectedNodeIds)
    get().saveHistory()
    set({
      nodes: nodes.filter(n => !nodeIds.has(n.id)),
      edges: edges.filter(e => {
        const src = e.source || e.sourceId
        const tgt = e.target || e.targetId
        return !nodeIds.has(src) && !nodeIds.has(tgt) && !selectedEdgeIds.some(seid => seid === e.id)
      }),
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectedNode: null,
      selectedNodes: [],
      selectedEdge: null,
      selectedEdges: [],
      validationHighlight: null,
    })
  },

  addCustomBlockType: (blockDef) => {
    const newType = {
      id: `custom-${Date.now()}`,
      ...blockDef,
      isCustom: true,
    }
    set({ customBlockTypes: [...get().customBlockTypes, newType] })
    return newType
  },

  removeCustomBlockType: (id) => {
    set({ customBlockTypes: get().customBlockTypes.filter(b => b.id !== id) })
  },

  addCustomEdgeType: (edgeDef) => {
    const newType = {
      id: `custom-edge-${Date.now()}`,
      ...edgeDef,
      isCustom: true,
    }
    set({ customEdgeTypes: [...get().customEdgeTypes, newType] })
    return newType
  },

  removeCustomEdgeType: (id) => {
    set({ customEdgeTypes: get().customEdgeTypes.filter(e => e.id !== id) })
  },

  getAllBlockTypes: () => [...BLOCK_TYPES, ...get().customBlockTypes],
  getAllConnectionTypes: () => [...CONNECTION_TYPES, ...get().customEdgeTypes],

  setSimulationMetrics: (metrics) => set({ simulationMetrics: metrics }),

  // ==========================================================================
  // FIX: loadDesign now restores edge.config into edge.data
  // ==========================================================================
  loadDesign: (design) => {
    // Migrate nodes: sanitize config + inject missing behavioralModel
    const migratedNodes = (design.nodes || []).map(node => {
      const config = stripDecorativeProps(node.data?.config || {})
      if (!config.behavioralModel) {
        const blockType = node.data?.type || 'service'
        config.behavioralModel = getBlockBehavioralModel(blockType)
      }
      return {
        ...node,
        data: {
          ...node.data,
          config,
        },
      }
    })

    // FIX: Migrate edges — restore DB config into React Flow data
    const migratedEdges = (design.edges || []).map(edge => {
      const dbConfig = edge.config && typeof edge.config === 'object' ? edge.config : {}
      const edgeData = stripDecorativeProps({ ...dbConfig, ...(edge.data || {}) })
      if (!edgeData.behavioralModel) {
        const connType = edgeData.connectionType || edge.connectionType || 'http'
        edgeData.behavioralModel = getConnectionBehavioralModel(connType)
      }
      const source = edge.source || edge.sourceId
      const target = edge.target || edge.targetId
      // Strip DB-only fields so React Flow edge is clean
      const { config: _dbConfig, ...edgeRest } = edge
      return {
        ...edgeRest,
        source,
        target,
        sourceId: source,
        targetId: target,
        data: edgeData,
      }
    })

    set({
      nodes: migratedNodes,
      edges: migratedEdges,
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectedNode: null,
      selectedNodes: [],
      selectedEdge: null,
      selectedEdges: [],
      validationHighlight: null,
      highlightedBlockId: null,
      simulationRunning: false,
      simulationMetrics: null,
      simulationBlockMetrics: {},
      simulationEdgeMetrics: {},
      simulationAlerts: [],
      simulationConfig: null,
      validationResult: null,
      showValidationPanel: false,
      history: [],
      historyIndex: -1,
      simulationStatus: 'idle',
      simulationProgress: 0,
      simulationReportId: null,
      simulationAutoOpenReport: false,
      simulationErrorMessage: null,
    })
  },

  clearCanvas: () => {
    get().saveHistory()
    set({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectedNode: null,
      selectedNodes: [],
      selectedEdge: null,
      selectedEdges: [],
      validationHighlight: null,
      highlightedBlockId: null,
      simulationRunning: false,
      simulationMetrics: null,
      simulationBlockMetrics: {},
      simulationEdgeMetrics: {},
      simulationAlerts: [],
      simulationConfig: null,
      validationResult: null,
      showValidationPanel: false,
      history: [],
      historyIndex: -1,
      simulationStatus: 'idle',
      simulationProgress: 0,
      simulationReportId: null,
      simulationAutoOpenReport: false,
      simulationErrorMessage: null,
    })
  },
}))

// ============================================================================
// DEEP MERGE UTILITY
// ============================================================================

function deepMerge(target, source) {
  const result = JSON.parse(JSON.stringify(target || {}))
  for (const key in source) {
    if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key])
    } else {
      result[key] = source[key]
    }
  }
  return result
}

export const DECORATIVE_PROPS = new Set([
  'id', 'position', 'width', 'height', 'style', 'className',
  'draggable', 'selectable', 'connectable', 'parentId', 'zIndex',
  'selected', 'dragging', 'resizing', 'source', 'target'
])