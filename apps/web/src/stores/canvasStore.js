import { create } from 'zustand'
import { BLOCK_TYPES } from '@shared/constants'

export const useCanvasStore = create((set, get) => ({
  nodes: [],
  edges: [],
  selectedNode: null,
  simulationRunning: false,
  simulationMetrics: null,
  activeTab: 'editor',
  zoom: 1,

  addNode: (type, position) => {
    const blockType = BLOCK_TYPES.find(b => b.id === type)
    const newNode = {
      id: `${type}-${Date.now()}`,
      type: 'customBlock',
      position,
      data: {
        label: blockType.label,
        type: type,
        icon: blockType.icon,
        color: blockType.color,
        config: getDefaultConfig(type),
      },
    }
    set({ nodes: [...get().nodes, newNode] })
    return newNode
  },

  updateNode: (id, updates) => {
    set({
      nodes: get().nodes.map(n =>
        n.id === id ? { ...n, data: { ...n.data, ...updates } } : n
      )
    })
  },

  removeNode: (id) => {
    set({
      nodes: get().nodes.filter(n => n.id !== id),
      edges: get().edges.filter(e => e.source !== id && e.target !== id),
      selectedNode: get().selectedNode?.id === id ? null : get().selectedNode,
    })
  },

  addEdge: (edge) => {
    const exists = get().edges.some(
      e => e.source === edge.source && e.target === edge.target
    )
    if (!exists) {
      set({ edges: [...get().edges, { ...edge, id: `e-${Date.now()}` }] })
    }
  },

  removeEdge: (id) => {
    set({ edges: get().edges.filter(e => e.id !== id) })
  },

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setSelectedNode: (node) => set({ selectedNode: node }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setZoom: (zoom) => set({ zoom }),

  startSimulation: () => {
    set({ simulationRunning: true, simulationMetrics: null })
  },

  stopSimulation: () => {
    set({ simulationRunning: false })
  },

  setSimulationMetrics: (metrics) => set({ simulationMetrics: metrics }),

  loadDesign: (design) => {
    set({
      nodes: design.nodes || [],
      edges: design.edges || [],
      selectedNode: null,
      simulationRunning: false,
      simulationMetrics: null,
    })
  },

  clearCanvas: () => {
    set({
      nodes: [],
      edges: [],
      selectedNode: null,
      simulationRunning: false,
      simulationMetrics: null,
    })
  },
}))

function getDefaultConfig(type) {
  switch (type) {
    case 'api-gateway':
      return { rateLimit: 1000, authType: 'jwt', timeout: 30000, port: 80 }
    case 'service':
      return { port: 3000, replicas: 3, cpu: '500m', memory: '1Gi' }
    case 'database':
      return { engine: 'postgres', database: 'app', user: 'user', password: 'password', port: 5432 }
    case 'cache':
      return { engine: 'redis', maxMemory: '256mb', eviction: 'allkeys-lru', port: 6379 }
    case 'message-queue':
      return { engine: 'kafka', partitions: 3, replication: 2, port: 9092 }
    case 'load-balancer':
      return { algorithm: 'round-robin', healthCheck: true, port: 80 }
    case 'cdn':
      return { provider: 'cloudfront', caching: '1h', ssl: true }
    case 'client':
      return { framework: 'react', ssr: false, caching: true }
    case 'external-api':
      return { url: '', auth: 'api-key', rateLimit: 100 }
    case 'storage':
      return { provider: 's3', encryption: true, region: 'us-east-1' }
    default:
      return {}
  }
}
