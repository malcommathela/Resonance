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
import {
  COLLAPSED_W,
  COLLAPSED_H,
  GROUP_Z_INDEX,
  NODE_Z_INDEX,
  GROUP_DRAG_HANDLE,
  EMPTY_GROUP_W,
  EMPTY_GROUP_H,
  groupBox,
  expandGroupBox,
  pruneGroupMembers,
  readCanvasMeta,
} from '@/features/canvas/groups/meta'
import { pruneFindings } from '@/features/canvas/validation/validationAdapter'

// Drop findings whose elements are gone after a delete; canvas-level findings stay.
function dropDeletedFindings(validationResult, nodes, edges) {
  if (!validationResult?.findings) return validationResult
  return { ...validationResult, findings: pruneFindings(validationResult.findings, nodes, edges) }
}

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
  // ==========================================================================
  // DOMAIN MAP (Phase 11). One store, explicit sections — split into separate
  // stores only if a domain measurably needs isolation. Selectors in
  // features/canvas/core/canvasSelectors.js are the subscription boundary.
  //   Document ......... nodes, edges, revision, viewport, history
  //   Selection ........ selected*, groupDropTarget (transient)
  //   Validation ....... validationResult/Revision, isValidating, highlight
  //   Simulation runtime simulation* (maps only — never node.data; sim ticks
  //                      must not re-render architecture or dirty the document)
  //   UI ............... panels, activeTab, zoom, nodePicker
  //   Persistence ...... isDirty, persistedRevision
  // ==========================================================================

  // --- Document ---
  nodes: [],
  edges: [],

  // Phase 1: monotonic document revision — bumped alongside every isDirty set
  // (saveHistory covers history mutations; non-history mutators bump inline).
  // Basis for validation/autosave freshness and future undo/collab.
  revision: 0,
  viewport: { x: 0, y: 0, zoom: 1 },
  persistedRevision: 0,

  isDirty: false,

  // --- Selection (+ transient validation emphasis; distinct from selection) ---
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
  nodePicker: null, // { sourceId: string | null } while the node picker is open
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
  validationRevision: null, // document revision the result was computed for
  isValidating: false,
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
  groupDropTarget: null, // transient drag highlight id — never persisted, never in history

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

  openNodePicker: (sourceId = null) => set({ nodePicker: { sourceId } }),

  closeNodePicker: () => set({ nodePicker: null }),

  // ==========================================================================
  // GROUPS (Phase 8 — canvas-only objects, localStorage persistence)
  // ==========================================================================

  createEmptyGroup: (position) => {
    get().saveHistory()
    const { nodes } = get()
    const existing = nodes.filter((n) => n.type === 'group').length
    const at = position || { x: 0, y: 0 }
    const node = {
      id: `group-${Date.now()}`,
      type: 'group',
      position: { x: Math.round(at.x), y: Math.round(at.y) },
      draggable: true,
      selectable: true,
      zIndex: GROUP_Z_INDEX,
      dragHandle: `.${GROUP_DRAG_HANDLE}`,
      style: { width: EMPTY_GROUP_W, height: EMPTY_GROUP_H },
      data: {
        label: 'New Group',
        nodeIds: [],
        collapsed: false,
        memberCount: 0,
        justCreated: true,
      },
    }
    set({ nodes: [...get().nodes, node], isDirty: true })
    return node
  },

  addGroupMember: (groupId, nodeId) => {
    const { nodes } = get()
    const g = nodes.find((n) => n.id === groupId && n.type === 'group')
    const n = nodes.find((x) => x.id === nodeId)
    if (!g || !n || n.type !== 'customBlock' || g.data?.collapsed) return false
    if ((g.data?.nodeIds || []).includes(nodeId)) return false
    get().saveHistory()
    set({
      nodes: get().nodes.map((x) => {
        if (x.type !== 'group') return x
        const ids = (x.data?.nodeIds || []).filter((id) => id !== nodeId)
        if (x.id === groupId) ids.push(nodeId)
        if (ids.length === (x.data?.nodeIds || []).length && x.id !== groupId) return x
        return { ...x, data: { ...x.data, nodeIds: ids, memberCount: ids.length } }
      }),
      isDirty: true,
    })
    return true
  },

  removeGroupMember: (groupId, nodeId) => {
    const g = get().nodes.find((n) => n.id === groupId && n.type === 'group')
    if (!g || !(g.data?.nodeIds || []).includes(nodeId)) return false
    get().saveHistory()
    const ids = g.data.nodeIds.filter((id) => id !== nodeId)
    set({
      nodes: get().nodes.map((x) => x.id === groupId && x.type === 'group'
        ? { ...x, data: { ...x.data, nodeIds: ids, memberCount: ids.length } }
        : x),
      isDirty: true,
    })
    return true
  },

  setGroupDropTarget: (id) => {
    if (get().groupDropTarget !== id) set({ groupDropTarget: id })
  },

  createGroup: () => {
    const { selectedNodeIds, nodes } = get()
    const ids = selectedNodeIds.filter((gid) => nodes.some((n) => n.id === gid && n.type === 'customBlock'))
    if (ids.length < 2) return null
    get().saveHistory()
    const members = nodes.filter((n) => ids.includes(n.id))
    const box = groupBox(members) || { x: 0, y: 0, width: EMPTY_GROUP_W, height: EMPTY_GROUP_H }
    const existing = nodes.filter((n) => n.type === 'group').length
    const node = {
      id: `group-${Date.now()}`,
      type: 'group',
      position: { x: box.x, y: box.y },
      draggable: true,
      selectable: true,
      // Explicit backdrop layer (never negative); drag restricted to the header.
      zIndex: GROUP_Z_INDEX,
      dragHandle: `.${GROUP_DRAG_HANDLE}`,
      style: { width: box.width, height: box.height },
      data: {
        label: `Group ${existing + 1}`,
        nodeIds: ids,
        collapsed: false,
        memberCount: ids.length,
        justCreated: true,
      },
    }
    set({ nodes: [...get().nodes, node], isDirty: true })
    return node
  },

  renameGroup: (id, label) => {
    const next = (label || '').trim()
    if (!next) return
    const g = get().nodes.find((n) => n.id === id && n.type === 'group')
    if (!g) return
    const same = next === (g.data?.label || '')
    if (same && !g.data?.justCreated) return
    // Clearing justCreated after a cancelled first rename is not a content
    // change — no history entry for it.
    if (!same) get().saveHistory()
    set({
      nodes: get().nodes.map((n) => n.id === id && n.type === 'group' ? { ...n, data: { ...n.data, label: next, justCreated: false } } : n),
      isDirty: true,
    })
  },

  // Dedicated group movement (§7-8): rigid delta applied to group + members
  // in ONE history entry. React Flow already moved the group in the store
  // via onNodesChange, so the pre-drag state is reconstructed from `start`
  // and pushed explicitly — saving history here would capture a half-moved
  // canvas (group moved, members not). Edges follow: they reference node
  // ids, and RF re-renders them from member positions.
  moveGroup: (id, position, start) => {
    const { nodes, edges, history, historyIndex, maxHistorySize } = get()
    const g = nodes.find((n) => n.id === id && n.type === 'group')
    if (!g || !start) return
    const nx = snapToGrid(position.x)
    const ny = snapToGrid(position.y)
    const dx = nx - start.group.x
    const dy = ny - start.group.y
    if (dx === 0 && dy === 0) return
    const memberIds = new Set(g.data?.nodeIds || [])
    // Reconstruct the true pre-drag state (RF streamed the group live).
    const preNodes = nodes.map((n) => {
      if (n.id === id) return { ...g, position: { ...start.group } }
      if (memberIds.has(n.id) && start.members[n.id]) return { ...n, position: { ...start.members[n.id] } }
      return n
    })
    const clone = (o) => JSON.parse(JSON.stringify(o))
    // Forward application IS the tested pure helper (snapped per position).
    const { nodes: next } = shiftGroupNodes(preNodes, id, dx, dy, snapToGrid)
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push({ nodes: clone(preNodes), edges: clone(edges) })
    if (newHistory.length > maxHistorySize) newHistory.shift()
    set({ nodes: next, history: newHistory, historyIndex: newHistory.length - 1, isDirty: true, revision: get().revision + 1 })
  },

  // Single-undo resize commit: keep the user's size, only grow to fit members.
  // RF streams the new size into the store during the gesture, so the true
  // pre-resize size comes from `start` (captured in onResizeStart) — the same
  // half-mutated-history problem moveGroup solves. Unchanged size = no entry.
  commitGroupResize: (id, start) => {
    const { nodes, edges, history, historyIndex, maxHistorySize } = get()
    const g = nodes.find((n) => n.id === id && n.type === 'group')
    if (!g || g.data?.collapsed) return
    const startStyle = start && typeof start.width === 'number' ? start : null
    if (startStyle && startStyle.width === g.style?.width && startStyle.height === g.style?.height) return
    const byId = new Map(nodes.map((n) => [n.id, n]))
    const members = (g.data?.nodeIds || []).map((mid) => byId.get(mid)).filter((m) => m && m.type === 'customBlock')
    const box = expandGroupBox(g, members)
    const clone = (o) => JSON.parse(JSON.stringify(o))
    const preNodes = startStyle
      ? nodes.map((n) => (n.id === id ? { ...n, style: { ...(n.style || {}), ...startStyle } } : n))
      : clone(nodes)
    const next = !box ? nodes : nodes.map((n) => {
      if (n.id !== id) return n
      return { ...n, position: { x: box.x, y: box.y }, style: { ...(n.style || {}), width: box.width, height: box.height } }
    })
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push({ nodes: clone(preNodes), edges: clone(edges) })
    if (newHistory.length > maxHistorySize) newHistory.shift()
    set({ nodes: next, history: newHistory, historyIndex: newHistory.length - 1, isDirty: true, revision: get().revision + 1 })
  },

  toggleGroupCollapse: (id) => {
    const { nodes, edges } = get()
    const g = nodes.find((n) => n.id === id && n.type === 'group')
    if (!g) return
    const collapsed = !g.data?.collapsed
    const memberIds = new Set(g.data?.nodeIds || [])
    const collapsedIds = new Set()
    nodes.forEach((n) => {
      if (n.type === 'group' && (n.id === id ? collapsed : n.data?.collapsed)) {
        ;(n.data?.nodeIds || []).forEach((m) => collapsedIds.add(m))
      }
    })
    get().saveHistory()
    set({
      nodes: nodes.map((n) => {
        if (n.id === id) {
          // Expand keeps the user's manual size; only grow when members no longer fit.
          const box = collapsed ? null : expandGroupBox(n, nodes.filter((m) => memberIds.has(m.id) && m.type === 'customBlock'))
          return {
            ...n,
            ...(box ? { position: { x: box.x, y: box.y } } : {}),
            style: collapsed
              ? { width: COLLAPSED_W, height: COLLAPSED_H }
              : { ...(n.style || {}), ...(box ? { width: box.width, height: box.height } : {}) },
            data: { ...n.data, collapsed },
          }
        }
        if (memberIds.has(n.id)) return { ...n, hidden: collapsed }
        return n
      }),
      edges: edges.map((e) => {
        const src = e.source || e.sourceId
        const tgt = e.target || e.targetId
        if (collapsedIds.has(src) || collapsedIds.has(tgt)) return e.hidden ? e : { ...e, hidden: true }
        return e.hidden ? { ...e, hidden: false } : e
      }),
      isDirty: true,
    })
  },

  ungroup: (id) => {
    const { nodes, edges } = get()
    const g = nodes.find((n) => n.id === id && n.type === 'group')
    if (!g) return
    get().saveHistory()
    const memberIds = new Set(g.data?.nodeIds || [])
    const collapsedIds = new Set()
    nodes.forEach((n) => {
      if (n.type === 'group' && n.id !== id && n.data?.collapsed) {
        ;(n.data?.nodeIds || []).forEach((m) => collapsedIds.add(m))
      }
    })
    set({
      nodes: nodes
        .filter((n) => n.id !== id)
        .map((n) => (memberIds.has(n.id) && n.hidden ? { ...n, hidden: false } : n)),
      edges: edges.map((e) => {
        const src = e.source || e.sourceId
        const tgt = e.target || e.targetId
        if (collapsedIds.has(src) || collapsedIds.has(tgt)) return e
        return e.hidden ? { ...e, hidden: false } : e
      }),
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectedNode: null,
      selectedNodes: [],
      selectedEdge: null,
      selectedEdges: [],
      isDirty: true,
    })
  },

  loadCanvasMeta: (designId) => {
    const meta = readCanvasMeta(designId)
    if (!meta) return
    const { nodes, edges } = get()
    const have = new Set(nodes.map((n) => n.id))
    // Normalize persisted groups to the movable/backdrop contract:
    // older metas stored draggable:false and zIndex:-1 or nothing.
    // Legacy note entries are ignored (never rendered, never written back).
    const fresh = [...meta.groups]
      .filter((n) => n && n.id && n.type === 'group' && !have.has(n.id))
      .map((n) => ({ ...n, draggable: true, zIndex: GROUP_Z_INDEX, dragHandle: `.${GROUP_DRAG_HANDLE}` }))
    if (!fresh.length) return
    const collapsedIds = new Set()
    fresh.forEach((n) => {
      if (n.type === 'group' && n.data?.collapsed) (n.data.nodeIds || []).forEach((m) => collapsedIds.add(m))
    })
    set({
      nodes: [...nodes, ...fresh].map((n) => (collapsedIds.has(n.id) && !n.hidden ? { ...n, hidden: true } : n)),
      edges: edges.map((e) => {
        const src = e.source || e.sourceId
        const tgt = e.target || e.targetId
        return (collapsedIds.has(src) || collapsedIds.has(tgt)) && !e.hidden ? { ...e, hidden: true } : e
      }),
    })
  },

  // ==========================================================================
  // VALIDATION HIGHLIGHT ACTIONS
  // ==========================================================================

  setValidationHighlight: (finding) => {
    if (!finding) {
      set({ validationHighlight: null })
      return
    }
    const elementId = finding.elementId || finding.blockId || finding.edgeId
    const elementType = finding.elementType || (finding.blockId ? 'node' : finding.edgeId ? 'edge' : 'node')
    // Root-cause stale guard: emphasis for a deleted/never-existing element is
    // ignored here so no caller can pan to a ghost. Canvas-level findings
    // (no elementId) always apply.
    if (elementId) {
      const { nodes, edges } = get()
      const list = elementType === 'edge' ? edges : nodes
      if (!list.some((n) => n.id === elementId)) return
    }
    set({
      validationHighlight: {
        elementId,
        elementType,
        findingId: finding.id,
        severity: finding.severity,
      },
    })
  },

  clearValidationHighlight: () => set({
    validationHighlight: null,
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
  // CANVAS PERSISTENCE STATE
  // ==========================================================================

  markCanvasDirty: () => set({ isDirty: true }),

  // Revision-safe clean: a stale save (older revision finishing after newer
  // edits) must not clear dirty. Only the save matching the current revision
  // cleans; no-arg callers (load/reset) clean unconditionally.
  markCanvasClean: (savedRevision) => set((s) => (savedRevision != null && savedRevision !== s.revision)
    ? { persistedRevision: Math.max(s.persistedRevision, savedRevision) }
    : { isDirty: false, persistedRevision: s.revision }),

  resetCanvasPersistence: () => set({ isDirty: false }),

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
    const { nodes, edges, history, historyIndex, maxHistorySize, revision } = get()
    const state = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges))
    }
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(state)
    if (newHistory.length > maxHistorySize) newHistory.shift()
    set({ history: newHistory, historyIndex: newHistory.length - 1, revision: revision + 1, isDirty: true })
  },

  undo: () => {
    const { nodes, edges, history, historyIndex } = get()
    if (historyIndex < 0) return
    const clone = (o) => JSON.parse(JSON.stringify(o))
    // ponytail: pre-state history + stash live for redo on first undo
    if (historyIndex === history.length - 1) {
      const live = { nodes: clone(nodes), edges: clone(edges) }
      const state = history[historyIndex]
      if (!state) return
      set({
        nodes: clone(state.nodes),
        edges: clone(state.edges),
        history: [...history, live],
        historyIndex,
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
      return
    }
    if (historyIndex === 0) return
    const prev = history[historyIndex - 1]
    if (!prev) return
    set({
      nodes: clone(prev.nodes),
      edges: clone(prev.edges),
      historyIndex: historyIndex - 1,
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
      zIndex: NODE_Z_INDEX,
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
    set({ nodes: [...get().nodes, newNode], isDirty: true })
    return newNode
  },

  duplicateNode: (id) => {
    const node = get().nodes.find(n => n.id === id)
    if (!node || node.type !== 'customBlock') return null
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
    set({ nodes: [...get().nodes, newNode], isDirty: true })
    return newNode
  },

  updateNode: (id, updates) => {
    // ponytail: no per-keystroke history here (would flood undo); revision still
    // bumps so validation/autosave see the edit. Commit-coalescing if it matters.
    const { nodes, selectedNodeId } = get()
    const next = nodes.map(n => {
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
    set({
      nodes: next,
      isDirty: true,
      revision: get().revision + 1,
      selectedNode: selectedNodeId === id ? next.find((n) => n.id === id) || null : get().selectedNode,
      selectedNodes: get().selectedNodes.map((n) => (n.id === id ? next.find((m) => m.id === id) || n : n)),
    })
  },

  updateNodePosition: (id, position) => {
    get().saveHistory()
    set({
      nodes: get().nodes.map(n =>
        n.id === id ? { ...n, position: { x: snapToGrid(position.x), y: snapToGrid(position.y) } } : n
      ),
      isDirty: true
    })
  },

  removeNode: (id) => get().deleteNodes([id]),

  addEdge: (edge, type = 'http') => {
    const src = edge.source || edge.sourceId
    const tgt = edge.target || edge.targetId
    if (!src || !tgt || src === tgt) return null
    const exists = get().edges.some(
      e => (e.source || e.sourceId) === src && (e.target || e.targetId) === tgt
    )
    get().saveHistory()
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
      set({ edges: [...get().edges, newEdge], isDirty: true })
      return newEdge
    }
    return null
  },

  removeEdge: (id) => get().deleteEdges([id]),

  updateEdge: (id, updates) => get().updateEdgeData(id, updates?.data || updates),

  updateEdgeData: (id, dataUpdates) => {
    const { edges, selectedEdgeId } = get()
    const next = edges.map(e => {
      if (e.id !== id) return e
      let mergedData = { ...e.data, ...dataUpdates }
      if (dataUpdates.connectionType && dataUpdates.connectionType !== e.data?.connectionType) {
        mergedData = { ...getDefaultEdgeConfig(dataUpdates.connectionType), ...mergedData }
      }
      if (dataUpdates.behavioralModel && typeof dataUpdates.behavioralModel === 'object') {
        mergedData.behavioralModel = deepMerge(mergedData.behavioralModel || {}, dataUpdates.behavioralModel)
      }
      return { ...e, data: mergedData }
    })
    set({
      edges: next,
      isDirty: true,
      revision: get().revision + 1,
      selectedEdge: selectedEdgeId === id ? next.find((e) => e.id === id) || null : get().selectedEdge,
    })
  },

  setNodes: (nodes) => set((s) => ({ nodes, revision: s.revision + 1 })),
  setEdges: (edges) => set((s) => ({ edges, revision: s.revision + 1 })),

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

  // Revision-safe: a response computed for an older revision is stale and
  // discarded, never displayed as if it described the current canvas.
  setValidationResult: (result, validatedRevision) => {
    if (validatedRevision != null && validatedRevision !== get().revision) return
    set({ validationResult: result, validationRevision: validatedRevision ?? get().revision })
  },
  setIsValidating: (val) => set({ isValidating: val }),
  setShowValidationPanel: (show) => set({ showValidationPanel: show }),
  clearValidation: () => set({
    validationResult: null,
    validationRevision: null,
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

  deleteNodes: (ids) => {
    const list = Array.isArray(ids) ? ids : [ids]
    if (!list.length) return
    const { nodes, edges, validationResult } = get()
    const idSet = new Set(list)
    if (!nodes.some((n) => idSet.has(n.id))) return
    get().saveHistory()
    const nextNodes = dropEmptyGroups(nodes.filter((n) => !idSet.has(n.id)))
    const nextEdges = edges.filter((e) => {
      const src = e.source || e.sourceId
      const tgt = e.target || e.targetId
      return !idSet.has(src) && !idSet.has(tgt)
    })
    set({
      nodes: nextNodes,
      edges: nextEdges,
      validationResult: dropDeletedFindings(validationResult, nextNodes, nextEdges),
      isDirty: true,
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

  deleteEdges: (ids) => {
    const list = Array.isArray(ids) ? ids : [ids]
    if (!list.length) return
    const { nodes, edges, validationResult } = get()
    const idSet = new Set(list)
    if (!edges.some((e) => idSet.has(e.id))) return
    get().saveHistory()
    const nextEdges = edges.filter((e) => !idSet.has(e.id))
    set({
      edges: nextEdges,
      validationResult: dropDeletedFindings(validationResult, nodes, nextEdges),
      isDirty: true,
      selectedEdgeId: null,
      selectedEdgeIds: [],
      selectedEdge: null,
      selectedEdges: [],
    })
  },

  deleteSelected: () => {
    const { selectedNodeIds, selectedEdgeIds, nodes, edges, validationResult } = get()
    if (!selectedNodeIds.length && !selectedEdgeIds.length) return
    const nodeIds = new Set(selectedNodeIds)
    get().saveHistory()
    const nextNodes = dropEmptyGroups(nodes.filter(n => !nodeIds.has(n.id)))
    const nextEdges = edges.filter(e => {
      const src = e.source || e.sourceId
      const tgt = e.target || e.targetId
      return !nodeIds.has(src) && !nodeIds.has(tgt) && !selectedEdgeIds.some(seid => seid === e.id)
    })
    set({
      nodes: nextNodes,
      edges: nextEdges,
      validationResult: dropDeletedFindings(validationResult, nextNodes, nextEdges),
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
    // Migrate nodes: sanitize config + inject missing behavioralModel.
    // Legacy `note` nodes are dropped (ignored, never rendered/written back).
    const migratedNodes = (design.nodes || []).filter((node) => node?.type !== 'note').map(node => {
      const config = stripDecorativeProps(node.data?.config || {})
      if (!config.behavioralModel) {
        const blockType = node.data?.type || 'service'
        config.behavioralModel = getBlockBehavioralModel(blockType)
      }
      // Normalize explicit canvas layers (older designs stored no zIndex).
      return {
        ...node,
        ...(node.zIndex == null ? { zIndex: node.type === 'group' ? GROUP_Z_INDEX : NODE_Z_INDEX } : {}),
        ...(node.type === 'group' ? { draggable: true, dragHandle: `.${GROUP_DRAG_HANDLE}` } : {}),
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
      revision: 0,
      persistedRevision: 0,
      isDirty: false,
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      selectedNode: null,
      selectedNodes: [],
      selectedEdge: null,
      selectedEdges: [],
      validationHighlight: null,
      simulationRunning: false,
      simulationMetrics: null,
      simulationBlockMetrics: {},
      simulationEdgeMetrics: {},
      simulationAlerts: [],
      simulationConfig: null,
      validationResult: null,
      validationRevision: null,
      showValidationPanel: false,
      nodePicker: null,
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
      simulationRunning: false,
      simulationMetrics: null,
      simulationBlockMetrics: {},
      simulationEdgeMetrics: {},
      simulationAlerts: [],
      simulationConfig: null,
      validationResult: null,
      validationRevision: null,
      showValidationPanel: false,
      nodePicker: null,
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
// GROUP MEMBERSHIP PRUNING (Phase 8)
// ============================================================================

// Refresh group membership after deletions; groups are always kept (possibly
// empty) — only explicit Delete/Ungroup removes a group.
function dropEmptyGroups(nodes) {
  const groups = nodes.filter((n) => n.type === 'group')
  if (groups.length === 0) return nodes
  const { kept } = pruneGroupMembers(groups, nodes.map((n) => n.id))
  const unchanged = kept.every((k) => {
    const orig = nodes.find((n) => n.id === k.id)
    return orig && (orig.data?.nodeIds || []).length === k.data.nodeIds.length
  })
  if (unchanged) return nodes
  const keptById = new Map(kept.map((k) => [k.id, k]))
  return nodes.map((n) => keptById.get(n.id) || n)
}

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