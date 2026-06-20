import { create } from 'zustand'
import { BLOCK_TYPES, CONNECTION_TYPES, categories } from '@shared/constants'

const GRID_SIZE = 20

function snapToGrid(value) {
  return Math.round(value / GRID_SIZE) * GRID_SIZE
}

export const useCanvasStore = create((set, get) => ({
  nodes: [],
  edges: [],
  selectedNode: null,
  selectedNodes: [],
  selectedEdge: null,
  selectedEdges: [],
  simulationRunning: false,
  simulationMetrics: null,
  activeTab: 'editor',
  zoom: 1,

  // Custom types registry (persisted in memory per session)
  customBlockTypes: [],
  customEdgeTypes: [],

  // History
  history: [],
  historyIndex: -1,
  maxHistorySize: 50,

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
      selectedNode: null,
      selectedNodes: [],
      selectedEdge: null,
      selectedEdges: [],
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
      selectedNode: null,
      selectedNodes: [],
      selectedEdge: null,
      selectedEdges: [],
    })
  },

  addNode: (type, position, overrides = {}) => {
    get().saveHistory()
    const allTypes = [...BLOCK_TYPES, ...get().customBlockTypes]
    const blockType = allTypes.find(b => b.id === type)
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
        config: { ...getDefaultConfig(type), ...(overrides.config || {}) },
        isCustom: overrides.isCustom || false,
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
        return {
          ...n,
          data: { ...n.data, ...updates },
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
    set({
      nodes: get().nodes.filter(n => n.id !== id),
      edges: get().edges.filter(e => e.source !== id && e.target !== id),
      selectedNode: get().selectedNode?.id === id ? null : get().selectedNode,
      selectedNodes: get().selectedNodes.filter(n => n.id !== id),
    })
  },

  addEdge: (edge, type = 'http') => {
    get().saveHistory()
    const exists = get().edges.some(
      e => e.source === edge.source && e.target === edge.target
    )
    if (!exists) {
      set({
        edges: [...get().edges, {
          ...edge,
          id: `e-${Date.now()}`,
          type: 'customEdge',
          data: { connectionType: type, ...edge.data },
        }]
      })
    }
  },

  removeEdge: (id) => {
    get().saveHistory()
    set({ edges: get().edges.filter(e => e.id !== id) })
  },

  updateEdge: (id, updates) => {
    set({
      edges: get().edges.map(e =>
        e.id === id ? { ...e, data: { ...e.data, ...updates.data } } : e
      )
    })
  },

  updateEdgeData: (id, dataUpdates) => {
    set({
      edges: get().edges.map(e =>
        e.id === id ? { ...e, data: { ...e.data, ...dataUpdates } } : e
      )
    })
  },

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setSelectedNode: (node) => set({ selectedNode: node, selectedEdge: null }),
  setSelectedNodes: (nodes) => set({ selectedNodes: nodes, selectedNode: nodes[0] || null, selectedEdge: null }),
  setSelectedEdge: (edge) => set({ selectedEdge: edge, selectedNode: null, selectedNodes: [] }),
  setSelectedEdges: (edges) => set({ selectedEdges: edges, selectedEdge: edges[0] || null, selectedNode: null, selectedNodes: [] }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setZoom: (zoom) => set({ zoom }),

  deleteSelected: () => {
    const { selectedNodes, selectedEdges, nodes, edges } = get()
    const nodeIds = new Set(selectedNodes.map(n => n.id))
    get().saveHistory()
    set({
      nodes: nodes.filter(n => !nodeIds.has(n.id)),
      edges: edges.filter(e => !nodeIds.has(e.source) && !nodeIds.has(e.target) && !selectedEdges.some(se => se.id === e.id)),
      selectedNodes: [],
      selectedEdges: [],
      selectedNode: null,
      selectedEdge: null,
    })
  },

  // Custom block type creation
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

  // Custom edge type creation
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

  startSimulation: () => set({ simulationRunning: true, simulationMetrics: null }),
  stopSimulation: () => set({ simulationRunning: false }),
  setSimulationMetrics: (metrics) => set({ simulationMetrics: metrics }),

  loadDesign: (design) => {
    set({
      nodes: design.nodes || [],
      edges: design.edges || [],
      selectedNode: null,
      selectedNodes: [],
      selectedEdge: null,
      selectedEdges: [],
      simulationRunning: false,
      simulationMetrics: null,
      history: [],
      historyIndex: -1,
    })
  },

  clearCanvas: () => {
    get().saveHistory()
    set({
      nodes: [],
      edges: [],
      selectedNode: null,
      selectedNodes: [],
      selectedEdge: null,
      selectedEdges: [],
      simulationRunning: false,
      simulationMetrics: null,
      history: [],
      historyIndex: -1,
    })
  },
}))

function getDefaultConfig(type) {
  switch (type) {
    case 'api-gateway': return { rateLimit: 1000, authType: 'jwt', timeout: 30000, port: 80 }
    case 'service': return { port: 3000, replicas: 3, cpu: '500m', memory: '1Gi' }
    case 'database': return { engine: 'postgres', database: 'app', user: 'user', password: 'password', port: 5432 }
    case 'cache': return { engine: 'redis', maxMemory: '256mb', eviction: 'allkeys-lru', port: 6379 }
    case 'message-queue': return { engine: 'kafka', partitions: 3, replication: 2, port: 9092 }
    case 'load-balancer': return { algorithm: 'round-robin', healthCheck: true, port: 80 }
    case 'cdn': return { provider: 'cloudfront', caching: '1h', ssl: true }
    case 'client': return { framework: 'react', ssr: false, caching: true }
    case 'external-api': return { url: '', auth: 'api-key', rateLimit: 100 }
    case 'storage': return { provider: 's3', encryption: true, region: 'us-east-1' }
    default: return {}
  }
}