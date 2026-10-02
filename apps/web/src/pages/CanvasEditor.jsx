import React, { useEffect, useCallback, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  ReactFlowProvider,
  SelectionMode,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Play,
  Pause,
  ZoomIn,
  ZoomOut,
  Maximize,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Plus,
} from 'lucide-react'
import { useCanvasStore } from '@/stores/canvasStore'
import { useDesignStore } from '@/stores/designStore'
import { useAutoSave } from '@/hooks/useAutoSave'
import { blockIconMap } from '@/lib/iconMap'
import { BlockLibrary } from '@/components/canvas/BlockLibrary'
import { PropertyPanel } from '@/components/canvas/PropertyPanel'
import { TopToolbar } from '@/components/canvas/TopToolbar'
import { BottomPanel } from '@/components/canvas/BottomPanel'
import { SimulationOverlay } from '@/components/canvas/SimulationOverlay'
import { SimulationControls } from '@/components/canvas/SimulationControls'
import { ExportModal } from '@/components/canvas/ExportModal'
import { SimulationReportModal } from '@/components/canvas/SimulationReportModal'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { api, useApiWithAuth } from '@/services/api'
import { fetchSimulationReport } from '@/services/simulation'
// === P1 + BATCH 4: VALIDATION IMPORTS ===
import { ValidationPanel } from '@/components/canvas/ValidationPanel'
import { TopologyRiskOverlay } from '@/components/canvas/TopologyRiskOverlay'
import { getValidationSummary, preValidateArchitecture } from '@/lib/validation'
// === END P1 + BATCH 4 ===
import { useCanvasDocument } from '@/features/canvas/core/useCanvasDocument'
import { normalizeDocument, isBlockNode } from '@/features/canvas/core/document'
import { persistCanvasMeta } from '@/features/canvas/groups/meta'
import { nodeTypes, edgeTypes } from '@/features/canvas/core/canvasTypes'
import { canvasCommands } from '@/features/canvas/core/canvasCommands'
import { setFlowInstance } from '@/features/canvas/core/flowInstance'
import { NodePicker } from '@/features/canvas/picker/NodePicker'
import { InspectorShell } from '@/features/canvas/inspector/InspectorShell'
import { CanvasContextMenu } from '@/features/canvas/interactions/CanvasContextMenu'
import { SimulationBar } from '@/features/canvas/overlays/SimulationBar'

const edgeOptions = {
  type: 'customEdge',
  data: { connectionType: 'http' },
}

function CanvasEditorInner() {
  useApiWithAuth() // Registers Clerk token getter for api singleton

  const { id } = useParams()
  const navigate = useNavigate()
  const { loadDesign, currentDesign, saveCanvas, saveStatus, isLoading: designLoading } = useDesignStore()

  const [isInitialized, setIsInitialized] = useState(false)
  // Phase 11: selective subscriptions — sim ticks touch only runtime maps,
  // so the editor shell no longer re-renders on every simulation update.
  const simulationRunning = useCanvasStore((s) => s.simulationRunning)
  const activeTab = useCanvasStore((s) => s.activeTab)
  const panels = useCanvasStore((s) => s.panels)
  const togglePanel = useCanvasStore((s) => s.togglePanel)
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId)
  const selectedEdgeId = useCanvasStore((s) => s.selectedEdgeId)
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds)
  const selectedEdgeIds = useCanvasStore((s) => s.selectedEdgeIds)
  const validationHighlight = useCanvasStore((s) => s.validationHighlight)
  const selectNode = useCanvasStore((s) => s.selectNode)
  const selectEdge = useCanvasStore((s) => s.selectEdge)
  const clearSelection = useCanvasStore((s) => s.clearSelection)
  const setValidationHighlight = useCanvasStore((s) => s.setValidationHighlight)
  const clearValidationHighlight = useCanvasStore((s) => s.clearValidationHighlight)
  const validationResult = useCanvasStore((s) => s.validationResult)
  const isValidating = useCanvasStore((s) => s.isValidating)
  const setValidationResult = useCanvasStore((s) => s.setValidationResult)
  const setIsValidating = useCanvasStore((s) => s.setIsValidating)
  const setSimulationBlockMetrics = useCanvasStore((s) => s.setSimulationBlockMetrics)
  const setSimulationEdgeMetrics = useCanvasStore((s) => s.setSimulationEdgeMetrics)
  const setSimulationAlerts = useCanvasStore((s) => s.setSimulationAlerts)
  const setSelectedNode = useCanvasStore((s) => s.setSelectedNode)
  const setSelectedNodes = useCanvasStore((s) => s.setSelectedNodes)
  const setSelectedEdge = useCanvasStore((s) => s.setSelectedEdge)
  const setActiveTab = useCanvasStore((s) => s.setActiveTab)
  const addNode = useCanvasStore((s) => s.addNode)
  const updateNodePosition = useCanvasStore((s) => s.updateNodePosition)
  const startSimulation = useCanvasStore((s) => s.startSimulation)
  const stopSimulation = useCanvasStore((s) => s.stopSimulation)
  const setSimulationMetrics = useCanvasStore((s) => s.setSimulationMetrics)
  const loadCanvasDesign = useCanvasStore((s) => s.loadDesign)
  const clearCanvas = useCanvasStore((s) => s.clearCanvas)
  const getAllConnectionTypes = useCanvasStore((s) => s.getAllConnectionTypes)

  const { nodes, edges, handleNodesChange, handleEdgesChange } = useCanvasDocument()
  const [showExportModal, setShowExportModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [logs, setLogs] = useState([])
  const [simulationId, setSimulationId] = useState(null)
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false)
  const [showSaveNewModal, setShowSaveNewModal] = useState(false)
  const [newDesignName, setNewDesignName] = useState('')
  const [showEdgeTypeMenu, setShowEdgeTypeMenu] = useState(false)
  const [pendingConnection, setPendingConnection] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  // === BATCH 5: REPORT MODAL STATE (store-driven auto-open) ===
  const [showReportModal, setShowReportModal] = useState(false)
  const [currentReport, setCurrentReport] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  // === END BATCH 5 ===

  // Shared floating slot (Phase 9): one overlay — 'properties' OR 'validation', never both.
  const [activePanel, setActivePanel] = useState(null)
  const showValidationPanel = useCanvasStore((s) => s.showValidationPanel)
  const setShowValidationPanel = useCanvasStore((s) => s.setShowValidationPanel)
  // Bridge legacy store flag (SimulationControls badge) into the shared slot.
  useEffect(() => {
    setActivePanel((prev) => {
      if (showValidationPanel) return 'validation'
      return prev === 'validation' ? null : prev
    })
  }, [showValidationPanel])

  const reactFlow = useReactFlow()
  const { screenToFlowPosition, fitView, zoomIn, zoomOut, setCenter } = reactFlow
  useEffect(() => {
    setFlowInstance(reactFlow)
    return () => setFlowInstance(null)
  }, [reactFlow])
  const eventSourceRef = useRef(null)
  const simulationIntervalRef = useRef(null)
  const propertyPanelRef = useRef(null)
  // === BATCH 4: CANVAS CONTAINER REF FOR FOCUS MANAGEMENT ===
  const canvasContainerRef = useRef(null)
  // === END BATCH 4 ===
  // === BATCH 5: PREVENT DOUBLE-PROCESSING THE SAME SIMULATION ===
  const simulationHandledRef = useRef(new Set())
  // === END BATCH 5 ===

  const {
    saveStatus: autoSaveStatus,
    markHydrated,
    markDirty,
  } = useAutoSave(
    id,
    nodes,
    edges,
    Boolean(id && id !== 'new' && isInitialized),
    currentDesign?.version ?? null
  )

  // Inspector/store edits (updateNode/updateEdge/…) set store isDirty without
  // touching RF — bridge that into autosave so config edits persist.
  const storeDirty = useCanvasStore((s) => s.isDirty)
  useEffect(() => {
    if (storeDirty) markDirty()
  }, [storeDirty, markDirty])

  // Commit RF changes to the document store, then mark dirty for autosave
  const onNodesChangeWrapper = useCallback(
    (changes) => {
      handleNodesChange(changes)
      markDirty()
    },
    [handleNodesChange, markDirty]
  )

  const onEdgesChangeWrapper = useCallback(
    (changes) => {
      handleEdgesChange(changes)
      markDirty()
    },
    [handleEdgesChange, markDirty]
  )

  // === BATCH 5E: LOAD HISTORICAL REPORTS ON DESIGN LOAD ===
  useEffect(() => {
    if (id && id !== 'new') {
      useDesignStore.getState().loadReports(id).catch(() => {})
    }
  }, [id])
  // === END BATCH 5E ===

  // Persist canvas-only objects (groups/notes) per design; blocks/edges
  // keep flowing through the existing autosave pipeline.
  useEffect(() => {
    if (id && id !== 'new' && isInitialized) persistCanvasMeta(id, nodes)
  }, [id, isInitialized, nodes])

  // === P1: AUTO-VALIDATE ON DESIGN CHANGE ===
  useEffect(() => {
    if (id && id !== 'new' && nodes.length > 0 && !isValidating) {
      const timer = setTimeout(() => {
        handleRunValidation(false)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [nodes, edges, id])
  // === END P1 ===

  // === BATCH 3: VIEWPORT PAN ON VALIDATION HIGHLIGHT ===
  useEffect(() => {
    if (!validationHighlight || !setCenter) return

    const { elementId, elementType } = validationHighlight

    const centerOf = (n) => {
      const w = n.measured?.width ?? n.width ?? 200
      const h = n.measured?.height ?? n.height ?? 60
      return { x: n.position.x + w / 2, y: n.position.y + h / 2 }
    }
    if (elementType === 'node') {
      const node = nodes.find(n => n.id === elementId)
      if (node) {
        const c = centerOf(node)
        setCenter(c.x, c.y, { zoom: 1.2, duration: 800 })
      }
    } else if (elementType === 'edge') {
      const edge = edges.find(e => e.id === elementId)
      if (edge) {
        const sourceNode = nodes.find(n => n.id === (edge.source || edge.sourceId))
        const targetNode = nodes.find(n => n.id === (edge.target || edge.targetId))
        if (sourceNode && targetNode) {
          const a = centerOf(sourceNode)
          const b = centerOf(targetNode)
          setCenter((a.x + b.x) / 2, (a.y + b.y) / 2, { zoom: 1.2, duration: 800 })
        }
      }
    }
  }, [validationHighlight, setCenter, nodes, edges])
  // === END BATCH 3 ===

  // Marker click focuses the element (overlay only dispatches; selection stays the authority).
  useEffect(() => {
    const onBadge = (e) => {
      const st = useCanvasStore.getState()
      const centerOf = (n) => {
        const w = n.measured?.width ?? n.width ?? 200
        const h = n.measured?.height ?? n.height ?? 60
        return { x: n.position.x + w / 2, y: n.position.y + h / 2 }
      }
      const blockId = e.detail?.blockId
      if (blockId) {
        const node = st.nodes.find((n) => n.id === blockId)
        if (!node) return
        st.selectNode(blockId)
        const c = centerOf(node)
        setCenter(c.x, c.y, { zoom: 1.2, duration: 500 })
        return
      }
      const edgeId = e.detail?.edgeId
      if (edgeId) {
        const edge = st.edges.find((x) => x.id === edgeId)
        if (!edge) return
        const a = st.nodes.find((n) => n.id === (edge.source || edge.sourceId))
        const b = st.nodes.find((n) => n.id === (edge.target || edge.targetId))
        if (!a || !b) return
        st.selectEdge(edgeId)
        const ca = centerOf(a)
        const cb = centerOf(b)
        setCenter((ca.x + cb.x) / 2, (ca.y + cb.y) / 2, { zoom: 1.2, duration: 500 })
      }
    }
    window.addEventListener('resonance:highlight-block', onBadge)
    return () => window.removeEventListener('resonance:highlight-block', onBadge)
  }, [setCenter])

  // Load design
  useEffect(() => {
    let cancelled = false

    const init = async () => {
      /*
       * Existing design:
       *
       * Do NOT clear the visible canvas before the server response.
       * Empty state is not a valid representation of an unloaded design.
       */
      if (id && id !== 'new') {
        setIsInitialized(false)

        try {
          const design = await loadDesign(id)

          if (cancelled) return

          const loadedNodes = design?.nodes || []
          const loadedEdges = design?.edges || []

          /*
           * Hydrate the document store from the server snapshot.
           * useCanvasDocument mirrors it into React Flow (store → flow).
           */
          loadCanvasDesign(normalizeDocument({
            ...design,
            nodes: loadedNodes,
            edges: loadedEdges,
          }))

          // Canvas-only objects (groups/notes) rejoin from local storage,
          // then the full canvas state becomes the clean baseline.
          useCanvasStore.getState().loadCanvasMeta(id)
          const hydrated = useCanvasStore.getState()

          /*
           * Establish the loaded server state as the clean persistence
           * baseline. Empty is VALID here if the database legitimately
           * contains an empty design.
           */
          markHydrated(
            hydrated.nodes,
            hydrated.edges,
            design?.version ?? null
          )

          useCanvasStore.getState().markCanvasClean()

          setIsInitialized(true)
        } catch (err) {
          if (cancelled) return

          /*
           * CRITICAL:
           *
           * Never set initialized=true after a failed load.
           * Otherwise [] can become autosaveable.
           */
          setIsInitialized(false)

          setLogs(prev => [
            ...prev,
            {
              type: 'error',
              message: `Failed to load design: ${err.message}`,
              timestamp: Date.now(),
            },
          ])

          console.error('Failed to load design:', err)
        }

        return
      }

      /*
       * New design.
       */
      if (!cancelled) {
        clearCanvas()

        useCanvasStore.getState().markCanvasClean()

        markHydrated([], [], null)

        setIsInitialized(true)
      }
    }

    init()

    return () => {
      cancelled = true
    }
  }, [
    id,
    loadDesign,
    loadCanvasDesign,
    clearCanvas,
    markHydrated,
  ])

  // ==========================================================================
  // BATCH 4: FOCUS-AWARE KEYBOARD SHORTCUTS
  // ==========================================================================

  /**
   * Check if the user is currently editing text in any input/editable field.
   * Returns true if focus is inside an input, textarea, select, contenteditable,
   * or any element marked with data-canvas-input="true".
   */
  const isEditingText = () => {
    const active = document.activeElement
    if (!active || active === document.body) return false
    const tag = active.tagName.toLowerCase()
    const editable = active.isContentEditable
    const customInput = active.dataset.canvasInput === 'true'
    const inCanvasInput = active.closest('[data-canvas-input="true"]') !== null
    return ['input', 'textarea', 'select'].includes(tag) || editable || customInput || inCanvasInput
  }

  // Phase 6: contextual inspector opener (panel is editor-local; command covers selection).
  const openPropertiesFor = useCallback((kind, id) => {
    if (kind === 'edge') selectEdge(id)
    else canvasCommands.openInspector(id)
    setActivePanel('properties')
  }, [selectEdge])

  // Edge connection with type selection
  const onConnect = useCallback((params) => {
    setPendingConnection(params)
    setShowEdgeTypeMenu(true)
    markDirty()
  }, [])

  // Single edge-creation path: store owns the document, RF mirrors it.
  const handleCreateEdge = useCallback((type) => {
    if (!pendingConnection) return
    canvasCommands.connectNodes(pendingConnection.source, pendingConnection.target, type)
    markDirty()
    setPendingConnection(null)
    setShowEdgeTypeMenu(false)
  }, [pendingConnection, markDirty])

  const onNodeClick = useCallback((_, node) => {
    selectNode(node.id)
    setActivePanel('properties')
  }, [selectNode])
  const onEdgeClick = useCallback((_, edge) => {
    selectEdge(edge.id)
    setActivePanel('properties')
  }, [selectEdge])
  const onNodeDoubleClick = useCallback((_, node) => openPropertiesFor('node', node.id), [openPropertiesFor])
  const onEdgeDoubleClick = useCallback((_, edge) => openPropertiesFor('edge', edge.id), [openPropertiesFor])
  // Finding click highlights + pans only — validation stays open.
  // Properties open explicitly via Jump to Property / node click.
  const handleFindingClick = useCallback((finding) => {
    setValidationHighlight(finding)
  }, [setValidationHighlight])
  const onNodeContextMenu = useCallback((e, node) => {
    e.preventDefault()
    selectNode(node.id)
    setContextMenu({ x: e.clientX, y: e.clientY, kind: 'node', id: node.id })
  }, [selectNode])
  const onEdgeContextMenu = useCallback((e, edge) => {
    e.preventDefault()
    selectEdge(edge.id)
    setContextMenu({ x: e.clientX, y: e.clientY, kind: 'edge', id: edge.id })
  }, [selectEdge])
  const onPaneContextMenu = useCallback((e) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, kind: 'pane' })
  }, [])
  const onPaneClick = useCallback(() => {
    clearSelection()
    setShowEdgeTypeMenu(false)
    setPendingConnection(null)
    clearValidationHighlight()
    setContextMenu(null)
    if (activePanel === 'properties') setActivePanel(null)
    // BATCH 4: Return focus to canvas container so shortcuts work
    canvasContainerRef.current?.focus()
  }, [clearSelection, clearValidationHighlight, activePanel])

  const onSelectionChange = useCallback(({ nodes: selNodes, edges: selEdges }) => {
    if (selNodes.length === 1 && selEdges.length === 0) {
      selectNode(selNodes[0].id)
    } else if (selNodes.length === 0 && selEdges.length === 1) {
      selectEdge(selEdges[0].id)
    } else if (selNodes.length === 0 && selEdges.length === 0) {
      clearSelection()
    } else {
      // Multi-select: update store directly for bulk operations
      setSelectedNodes(selNodes)
      if (selEdges?.length > 0) setSelectedEdge(selEdges[0])
    }
  }, [selectNode, selectEdge, clearSelection, setSelectedNodes, setSelectedEdge])

  const onDragOver = useCallback((event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }, [])

  const onDrop = useCallback((event) => {
    event.preventDefault()
    const type = event.dataTransfer.getData('application/resonance-block')
    if (!type) return
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    const newNode = addNode(type, position)
    requestAnimationFrame(() => {
      setTimeout(() => {
        const el = document.querySelector(`[data-id="${newNode.id}"]`)
        if (el) {
          el.animate([
            { opacity: 0, transform: 'scale(0.5) translateY(20px)' },
            { opacity: 1, transform: 'scale(1) translateY(0)' }
          ], { duration: 500, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' })
        }
      }, 100)
    })
  }, [screenToFlowPosition, addNode])

  const onNodeDragStop = useCallback((_, node) => {
    updateNodePosition(node.id, node.position)
    useCanvasStore.getState().refreshGroupBoxes()
    markDirty()
  }, [updateNodePosition, markDirty])
  const onNodesDelete = useCallback((deletedNodes) => canvasCommands.deleteNodes(deletedNodes.map((n) => n.id)), [])
  const onEdgesDelete = useCallback((deletedEdges) => canvasCommands.deleteEdges(deletedEdges.map((e) => e.id)), [])

  const handleManualSave = async () => {
    if (!id || id === 'new') { setShowSaveNewModal(true); return }
    try {
      await saveCanvas(id, { nodes, edges })
      setLogs(prev => [...prev, { type: 'success', message: 'Design saved to cloud', timestamp: Date.now() }])
    } catch (err) {
      setLogs(prev => [...prev, { type: 'error', message: `Save failed: ${err.message}`, timestamp: Date.now() }])
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.abort()
      if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current)
    }
  }, [])

  // === BATCH 4: VALIDATION HANDLER ===
  const handleRunValidation = async (showPanel = true) => {
    if (!id || id === 'new') return
    setIsValidating(true)
    if (showPanel) {
      setActivePanel('validation')
      setShowValidationPanel(true)
    }

    try {
      // 1. Client-side pre-validation (instant feedback)
      const clientValidation = preValidateArchitecture(nodes.filter(isBlockNode), edges, null)

      // 2. Server-side validation (authoritative)
      const serverResult = await api.validateDesign(id)

      // 3. Merge: server findings take precedence, but keep client-only findings
      const merged = {
        ...serverResult,
        findings: [
          ...(clientValidation.findings || []),
          ...(serverResult.findings || []),
        ],
        canSimulate: serverResult.canSimulate && clientValidation.canSimulate,
        clientPreValidated: true,
      }

      // Deduplicate findings by id
      const seen = new Set()
      merged.findings = merged.findings.filter(f => {
        if (seen.has(f.id)) return false
        seen.add(f.id)
        return true
      })

      setValidationResult(merged)
      setLogs(prev => [...prev, {
        type: merged.canSimulate ? 'success' : 'error',
        message: getValidationSummary(merged),
        timestamp: Date.now()
      }])
    } catch (err) {
      // Fallback to client-side only if server is unreachable
      const clientValidation = preValidateArchitecture(nodes.filter(isBlockNode), edges, null)
      setValidationResult(clientValidation)
      setLogs(prev => [...prev, {
        type: 'error',
        message: `Server validation failed, using client-side: ${err.message}`,
        timestamp: Date.now()
      }])
    } finally {
      setIsValidating(false)
    }
  }
  // === END BATCH 4 ===

  // === BATCH 4: JUMP TO PROPERTY ===
  const handleJumpToProperty = (id, property, type) => {
    if (type === 'block') {
      const node = nodes.find(n => n.id === id)
      if (node) {
        setSelectedNode(node)
        setActivePanel('properties')
        // The PropertyPanel will receive the ref and scroll
        setTimeout(() => {
          propertyPanelRef.current?.scrollToProperty?.(property)
        }, 100)
      }
    } else if (type === 'edge') {
      const edge = edges.find(e => e.id === id)
      if (edge) {
        setSelectedEdge(edge)
        setActivePanel('properties')
      }
    }
  }
  // === END BATCH 4 ===

  // === BATCH 5: SIMULATION COMPLETION HANDLER ===
  const handleSimulationComplete = useCallback(async (simId, status, globalMetrics) => {
    // GUARD: SSE + poll can both fire for the same sim
    if (simulationHandledRef.current.has(simId)) return
    simulationHandledRef.current.add(simId)

    // OPEN MODAL IMMEDIATELY — skeleton will show while we poll
    setShowReportModal(true)
    setReportLoading(true)
    setCurrentReport(null)

    let report = null
    let attempts = 0
    const maxAttempts = 12 // ~2 min total with backoff

    while (!report && attempts < maxAttempts) {
      try {
        // Try report first
        report = await fetchSimulationReport(simId)
        if (report?.error) report = null
      } catch (err) {
        // 404 while worker is still writing — check status
        try {
          const statusRes = await api.getSimulationStatus(simId)
          if (statusRes.status === 'failed') {
            throw new Error('Simulation failed')
          }
          // If still running, keep waiting
        } catch (statusErr) {
          // ignore
        }
      }

      if (!report && attempts < maxAttempts - 1) {
        const delay = 2000 * Math.pow(1.5, attempts) // 2s, 3s, 4.5s, 6.7s...
        await new Promise(r => setTimeout(r, delay))
      }
      attempts++
    }

    if (report) {
      setCurrentReport(report)
      useDesignStore.getState().loadReport(simId)
      // FIX: mark complete WITHOUT re-triggering auto-open (we already opened it)
      useCanvasStore.getState().setSimulationComplete(simId, false)
      setLogs(prev => [...prev, { type: 'success', message: 'Simulation report loaded', timestamp: Date.now() }])
    } else {
      // Fallback to minimal report
      const minimalReport = buildMinimalReport(simId, status, globalMetrics, nodes, edges)
      setCurrentReport(minimalReport)
      useCanvasStore.getState().setSimulationComplete(simId, false)
      setLogs(prev => [...prev, { type: 'warning', message: 'Report unavailable — showing preliminary results', timestamp: Date.now() }])
    }

    setReportLoading(false)
  }, [nodes, edges, id])
  // === END BATCH 5 ===

  // === BATCH 5E: BUILD MINIMAL REPORT FROM GLOBAL METRICS ===
  const buildMinimalReport = (simId, status, globalMetrics, currentNodes, currentEdges) => {
    const totalRequests = globalMetrics?.totalRequests || 0
    const failedRequests = globalMetrics?.failedRequests || 0
    const droppedRequests = globalMetrics?.droppedRequests || 0
    const totalErrors = failedRequests + droppedRequests
    const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0
    const availability = totalRequests > 0 ? ((totalRequests - totalErrors) / totalRequests) * 100 : 100
    const avgLatency = globalMetrics?.avgLatencyMs || 0
    const p99Latency = globalMetrics?.p99LatencyMs || 0

    return {
      id: `report-${simId}`,
      simulationId: simId,
      designId: id || 'new',
      version: '1.0',
      overallScore: Math.round(
        Math.max(0, 100
          - (errorRate > 0.1 ? 40 : errorRate > 0.05 ? 25 : errorRate > 0.01 ? 15 : errorRate > 0.001 ? 5 : 0)
          - (avgLatency > 500 ? 30 : avgLatency > 200 ? 20 : avgLatency > 100 ? 10 : avgLatency > 50 ? 5 : 0)
          - (availability < 95 ? 30 : availability < 99 ? 20 : availability < 99.9 ? 10 : availability < 99.99 ? 5 : 0)
        )
      ),
      architectureScore: 70,
      dataCompletenessScore: 70,
      reliabilityScore: Math.round(Math.max(0, availability)),
      performanceScore: Math.round(Math.max(0, 100 - (avgLatency > 500 ? 30 : avgLatency > 200 ? 20 : avgLatency > 100 ? 10 : avgLatency > 50 ? 5 : 0))),
      costScore: 60,
      securityScore: 60,
      confidenceScore: 80,
      executiveSummary: {
        summary: `Simulation ${simId} completed with ${totalRequests.toLocaleString()} requests. Average latency: ${Math.round(avgLatency)}ms. Availability: ${availability.toFixed(2)}%.`,
        keyFinding: errorRate > 0.01
          ? `Elevated error rate detected (${(errorRate * 100).toFixed(2)}%). Investigate failure scenarios.`
          : avgLatency > 200
            ? `High average latency (${Math.round(avgLatency)}ms). Consider scaling or optimization.`
            : 'Simulation completed within acceptable parameters.',
        keyRecommendation: errorRate > 0.01
          ? 'Review error-prone blocks and consider redundancy.'
          : avgLatency > 200
            ? 'Scale horizontally or optimize hot paths.'
            : 'Continue monitoring and consider running Monte Carlo analysis.',
        overallScore: null,
        dataCompletenessScore: null,
        reliabilityScore: null,
        performanceScore: null,
        costScore: null,
        securityScore: null,
        confidenceScore: null,
        assumptionCount: 0,
        criticalAssumptionCount: 0,
        scorePenaltyFromAssumptions: 0,
      },
      topologyAnalysis: {
        nodeCount: currentNodes.length,
        edgeCount: currentEdges.length,
        avgFanOut: 0,
        maxFanOut: 0,
        avgFanIn: 0,
        maxFanIn: 0,
        cyclomaticComplexity: 0,
        connectedComponents: 1,
        totalBlocks: currentNodes.length,
        totalEdges: currentEdges.length,
        criticalErrors: [],
        warnings: [],
        risks: [],
        graphStructureSummary: `${currentNodes.length} nodes, ${currentEdges.length} edges in current design.`,
      },
      performanceAnalysis: {
        globalMetrics: {
          totalRequests,
          throughputRps: globalMetrics?.throughputRps || 0,
          avgLatencyMs: avgLatency,
          p99LatencyMs: p99Latency,
          errorRate: errorRate,
          availability,
          droppedRequests,
          failedRequests,
          totalSimulatedCost: globalMetrics?.totalSimulatedCost || 0,
          projectedMonthlyCost: globalMetrics?.projectedMonthlyCost || 0,
          projectedAnnualCost: globalMetrics?.projectedAnnualCost || 0,
        },
        topLatencyBlocks: [],
        topErrorBlocks: [],
        topUtilizationBlocks: [],
        topCostBlocks: [],
        endToEndLatency: {
          avg: avgLatency,
          p95: globalMetrics?.p95LatencyMs || 0,
          p99: p99Latency,
          percentiles: {
            p50: globalMetrics?.p50LatencyMs || avgLatency,
            p75: globalMetrics?.p75LatencyMs || 0,
            p90: globalMetrics?.p90LatencyMs || 0,
            p95: globalMetrics?.p95LatencyMs || 0,
            p99: p99Latency,
            p999: globalMetrics?.p999LatencyMs || 0,
          }
        },
        latencyBottleneck: null,
        throughputBottleneck: null,
        costBottleneck: null,
      },
      // FLAT — not wrapped in { analysis, recommendations }
      reliabilityAnalysis: {
        reliabilityScore: Math.round(Math.max(0, availability)),
        availability,
        mttrMinutes: 0,
        mtbfHours: 0,
        failureProbabilityPerDay: 0,
        singlePointsOfFailure: [],
        failureChains: [],
        blastRadiuses: [],
        recommendations: [],
        resilienceScore: null,
        explainability: null,
        blockAvailabilities: [],
      },
      // FLAT
      scalabilityAnalysis: {
        scalabilityScore: 60,
        saturationPoints: [],
        growthProjections: [],
        bottlenecks: [],
        supportsHorizontalScaling: true,
        supportsVerticalScaling: true,
        supportsAutoScaling: true,
        recommendations: [],
        explainability: null,
        capacityLimits: [],
        slaCompliance: [],
        errorDistribution: {},
      },
      // FLAT
      costAnalysis: {
        currentMonthlyCost: globalMetrics?.projectedMonthlyCost || 0,
        currentAnnualCost: (globalMetrics?.projectedMonthlyCost || 0) * 12,
        totalCost: globalMetrics?.totalSimulatedCost || 0,
        breakdown: { edges: [], blocks: [] },
        drivers: [],
        growthProjections: [],
        recommendations: [],
        confidence: null,
        assumptions: { notes: [] },
        explainability: null,
        currency: 'USD',
      },
      // FLAT
      securityAnalysis: {
        securityScore: 60,
        findings: [],
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        bySeverity: { critical: [], high: [], medium: [], low: [] },
        recommendations: [],
        explainability: null,
      },
      // ARRAY — not { results: [] }
      failureScenarios: [],
      // Correct shape for AI tab
      aiInsights: {
        fallback: true,
        insights: [],
        generatedAt: new Date().toISOString(),
        modelVersion: 'unknown',
        evidencePacket: null,
        bottleneckAnalysis: null,
        rootCauseAnalysis: null,
        optimizationRecommendations: null,
        riskAssessment: null,
        costOptimization: null,
      },
      actionPlan: {
        critical: [],
        high: [],
        medium: [],
        low: [],
        summary: errorRate > 0.01 || avgLatency > 200
          ? 'Action items generated from simulation results.'
          : 'No critical action items at this time.',
      },
      metadata: {
        engineVersion: '2.0',
        reportVersion: '1.0.0',
        assumptions: {},
        confidenceScore: 80,
        aiGenerated: null,
        aiModelVersion: null,
        aiFallback: true,
        aiEvidenceValidated: false,
        assumptionCount: 0,
        criticalAssumptionCount: 0,
        scorePenaltyFromAssumptions: 0,
      },
      generatedAt: new Date().toISOString(),
    }
  }
  // === END BATCH 5E ===

  // === REAL SIMULATION INTEGRATION ===
  const handleRunSimulation = async (config = {}) => {
    // === BATCH 4: PRE-FLIGHT VALIDATION ===
    // 1. Fast client-side pre-validation
    const preflight = preValidateArchitecture(nodes.filter(isBlockNode), edges, null)
    if (!preflight.canSimulate) {
      setActivePanel('validation')
      setValidationResult(preflight)
      setLogs(prev => [...prev, { type: 'error', message: 'Simulation blocked: fix critical errors first', timestamp: Date.now() }])
      return
    }

    // 2. If we have cached server validation, check it too
    if (validationResult && !validationResult.canSimulate) {
      setActivePanel('validation')
      setLogs(prev => [...prev, { type: 'error', message: 'Simulation blocked: fix critical errors first', timestamp: Date.now() }])
      return
    }
    // === END BATCH 4 ===

    // Always clean up old intervals first
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current)
      simulationIntervalRef.current = null
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.abort()
      eventSourceRef.current = null
    }

    if (simulationRunning) {
      if (simulationId) {
        try { await api.stopSimulation(simulationId) } catch (e) { /* ignore */ }
      }
      stopSimulation()
      useCanvasStore.getState().setSimulationProgress(0)
      setSimulationId(null)
      return
    }

    if (!id || id === 'new') {
      setLogs(prev => [...prev, { type: 'warning', message: 'Save design before running simulation', timestamp: Date.now() }])
      setShowSaveNewModal(true)
      return
    }

    startSimulation()
    useCanvasStore.getState().setSimulationConfig(config)
    setLogs(prev => [...prev, { type: 'info', message: 'Starting simulation...', timestamp: Date.now() }])
    useCanvasStore.getState().setSimulationProgress(0)

    try {
      const result = await api.runSimulation(id, {
        trafficPattern: config.trafficPattern || 'steady',
        rps: config.rps || 100,
        duration: config.duration || 300,
        scenario: config.scenario || 'none',
        monteCarloPasses: config.monteCarloPasses || 1,
        confidenceLevel: config.confidenceLevel || 0.95,
        growthScenario: config.growthScenario || null,
        trafficParams: config.trafficParams || {},
        // === BATCH 5C: FORWARD NEW FIELDS ===
        deterministicSeed: config.deterministicSeed,
        targetBlockId: config.targetBlockId,
        targetEdgeId: config.targetEdgeId,
        // === END BATCH 5C ===
      })

      const simId = result.simulationId
      setSimulationId(simId)
      setLogs(prev => [...prev, { type: 'success', message: `Simulation ${simId} started`, timestamp: Date.now() }])

      // SSE stream — switched to fetch-event-source for Clerk Bearer token auth
      const { fetchEventSource } = await import('@microsoft/fetch-event-source')
      const token = await api.getAuthToken()
      const ctrl = new AbortController()
      eventSourceRef.current = ctrl

      fetchEventSource(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/simulations/${simId}/stream`,
        {
          method: 'GET',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            Accept: 'text/event-stream',
          },
          credentials: 'include',
          signal: ctrl.signal,
          openWhenHidden: true,
          onmessage: (event) => {
            const data = JSON.parse(event.data)

            // Ignore heartbeats
            if (data.heartbeat) return

            if (data.error) {
              console.error('SSE error:', data.error)
              return
            }

            useCanvasStore.getState().setSimulationProgress(data.progress || 0)

            // === BATCH 5B: LIVE BLOCK METRICS (runtime map only) ===
            // Never written into node data: sim ticks must not churn the
            // document, dirty the design, or re-render unselected nodes.
            const blockMetricsMap = {}
            if (data.metrics && Object.keys(data.metrics).length > 0) {
              Object.entries(data.metrics).forEach(([blockId, metrics]) => {
                // Expanded block metrics for overlay + inspector
                blockMetricsMap[blockId] = {
                  rps: metrics.throughputRps || 0,
                  latency: Math.round(metrics.avgLatencyMs || 0),
                  errors: metrics.failedRequests || 0,
                  p95Latency: Math.round(metrics.p95LatencyMs || 0),
                  p99Latency: Math.round(metrics.p99LatencyMs || 0),
                  utilization: metrics.utilization || 0,
                  queueDepth: metrics.queueDepth || 0,
                  currentReplicas: metrics.currentReplicas || 1,
                  cpuPercent: metrics.resources?.cpuPercent || 0,
                  memoryPercent: metrics.resources?.memoryPercent || 0,
                  threadPoolUtilization: metrics.resources?.threadPoolUtilization || 0,
                  circuitOpen: metrics.circuitOpen || false,
                  retryCount: metrics.retryCount || 0,
                }
              })
              setSimulationBlockMetrics(blockMetricsMap)
            }

            // === BATCH 5B: LIVE EDGE METRICS (runtime map only — same rule as blocks) ===
            const edgeMetricsMap = {}
            if (data.edges && Object.keys(data.edges).length > 0) {
              Object.entries(data.edges).forEach(([edgeId, edgeMetrics]) => {
                edgeMetricsMap[edgeId] = {
                  circuitOpen: edgeMetrics.circuitOpen || false,
                  errorRate: edgeMetrics.errorRate || 0,
                  retryCount: edgeMetrics.retryCount || 0,
                  latencyMs: edgeMetrics.latencyMs || 0,
                }
              })
              setSimulationEdgeMetrics(edgeMetricsMap)
            }

            // === BATCH 5B: LIVE GLOBAL METRICS (expanded) ===
            let globalMetricsSnapshot = null
            if (data.global && Object.keys(data.global).length > 0) {
              const global = data.global
              const totalRequests = global.totalRequests || 0
              const failedRequests = global.failedRequests || 0
              const droppedRequests = global.droppedRequests || 0
              const totalErrors = failedRequests + droppedRequests

              globalMetricsSnapshot = {
                totalRequests: totalRequests,
                avgLatency: Math.round(global.avgLatencyMs || 0),
                p99Latency: Math.round(global.p99LatencyMs || 0),
                errorRate: totalRequests > 0
                  ? ((totalErrors / totalRequests) * 100).toFixed(2)
                  : '0.00',
                throughput: Math.round(global.throughputRps || 0),
                availability: totalRequests > 0
                  ? (((totalRequests - totalErrors) / totalRequests) * 100).toFixed(2)
                  : '100.00',
                duration: config.duration || 300,
                // Expanded
                percentiles: {
                  p50: global.p50LatencyMs || global.avgLatencyMs || 0,
                  p75: global.p75LatencyMs || 0,
                  p90: global.p90LatencyMs || 0,
                  p95: global.p95LatencyMs || 0,
                  p99: global.p99LatencyMs || 0,
                  p999: global.p999LatencyMs || 0,
                },
                costEstimate: {
                  hourlyCost: global.totalSimulatedCost && global.duration
                    ? (global.totalSimulatedCost / (global.duration / 3600))
                    : 0,
                  projectedMonthly: global.projectedMonthlyCost || 0,
                },
              }

              setSimulationMetrics(globalMetricsSnapshot)
            }

            // === BATCH 5B: ALERTS (server or derived) ===
            const alerts = []
            if (data.alerts && Array.isArray(data.alerts)) {
              alerts.push(...data.alerts)
            } else {
              // Derive from edge metrics
              Object.entries(edgeMetricsMap).forEach(([edgeId, em]) => {
                if (em.circuitOpen) {
                  alerts.push({ type: 'circuit_open', edgeId, message: `Circuit breaker open on ${edgeId}` })
                }
                if (em.retryCount > 10) {
                  alerts.push({ type: 'retry_storm', edgeId, message: `Retry storm detected on ${edgeId}` })
                }
              })
              // Derive from block metrics
              Object.entries(blockMetricsMap).forEach(([blockId, bm]) => {
                if (bm.utilization > 0.95) {
                  alerts.push({ type: 'saturation', blockId, message: `Block ${blockId} is saturated` })
                }
              })
            }
            if (alerts.length > 0) {
              setSimulationAlerts(alerts)
            }

            // === TRAFFIC SPIKE WARNINGS ===
            if (data.currentRps && data.currentRps > (config.rps || 100) * 10) {
              setLogs(prev => [...prev, {
                type: 'warning',
                message: `Traffic spike: ${Math.round(data.currentRps)} RPS`,
                timestamp: Date.now()
              }])
            }

            // === COMPLETION DETECTION ===
            if (data.status === 'completed' || data.status === 'stopped' || data.status === 'failed') {
              ctrl.abort()
              eventSourceRef.current = null
              stopSimulation()
              useCanvasStore.getState().setSimulationProgress(100)
              setSimulationId(null)

              setLogs(prev => [...prev, {
                type: data.status === 'failed' ? 'error' : 'success',
                message: data.status === 'failed'
                  ? `Simulation failed: ${data.errorMessage || 'Unknown error'}`
                  : `Simulation completed`,
                timestamp: Date.now()
              }])

              // === BATCH 5E: AUTO-OPEN REPORT MODAL ON COMPLETION ===
              if (data.status === 'failed') {
                useCanvasStore.getState().setSimulationFailed(data.errorMessage || 'Unknown error')
              }
              if (data.status === 'completed' || data.status === 'stopped') {
                handleSimulationComplete(simId, data.status, globalMetricsSnapshot || data.global)
              }
              // === END BATCH 5E ===
            }
          },
          onerror: (err) => {
            // Stop retrying on auth errors
            if (err?.status === 401) {
              console.error('[SSE] 401 Unauthorized — stopping stream')
              ctrl.abort()
              eventSourceRef.current = null
              return
            }
            // Let fetch-event-source retry with backoff for transient errors
            throw err
          },
        }
      )

      // Poll for completion (fallback if SSE drops)
      simulationIntervalRef.current = setInterval(async () => {
        try {
          const status = await api.getSimulationStatus(simId)
          if (status.status === 'completed' || status.status === 'stopped' || status.status === 'failed') {
            clearInterval(simulationIntervalRef.current)
            simulationIntervalRef.current = null
            if (eventSourceRef.current) { eventSourceRef.current.abort(); eventSourceRef.current = null }
            stopSimulation()
            useCanvasStore.getState().setSimulationProgress(100)
            setSimulationId(null)

            // Map DB fields (P2 names) to UI fields
            let globalMetricsSnapshot = null
            if (status.globalMetrics) {
              const global = status.globalMetrics
              const totalRequests = global.totalRequests || 0
              const failedRequests = global.failedRequests || 0
              const droppedRequests = global.droppedRequests || 0
              const totalErrors = failedRequests + droppedRequests

              globalMetricsSnapshot = {
                totalRequests: totalRequests,
                avgLatency: Math.round(global.avgLatencyMs || 0),
                p99Latency: Math.round(global.p99LatencyMs || 0),
                errorRate: totalRequests > 0
                  ? ((totalErrors / totalRequests) * 100).toFixed(2)
                  : '0.00',
                throughput: Math.round(global.throughputRps || 0),
                availability: totalRequests > 0
                  ? (((totalRequests - totalErrors) / totalRequests) * 100).toFixed(2)
                  : '100.00',
                duration: global.duration || (config.duration || 300),
                // Expanded
                percentiles: {
                  p50: global.p50LatencyMs || global.avgLatencyMs || 0,
                  p75: global.p75LatencyMs || 0,
                  p90: global.p90LatencyMs || 0,
                  p95: global.p95LatencyMs || 0,
                  p99: global.p99LatencyMs || 0,
                  p999: global.p999LatencyMs || 0,
                },
                costEstimate: {
                  hourlyCost: global.totalSimulatedCost && global.duration
                    ? (global.totalSimulatedCost / (global.duration / 3600))
                    : 0,
                  projectedMonthly: global.projectedMonthlyCost || 0,
                },
              }

              setSimulationMetrics(globalMetricsSnapshot)
            }

            setLogs(prev => [...prev, {
              type: status.status === 'failed' ? 'error' : 'success',
              message: status.status === 'failed'
                ? `Simulation failed: ${status.errorMessage || 'Unknown error'}`
                : `Simulation completed`,
              timestamp: Date.now()
            }])

            // === BATCH 5E: AUTO-OPEN REPORT MODAL ON POLL COMPLETION ===
            if (status.status === 'failed') {
              useCanvasStore.getState().setSimulationFailed(status.errorMessage || 'Unknown error')
            }
            if (status.status === 'completed' || status.status === 'stopped') {
              handleSimulationComplete(simId, status.status, globalMetricsSnapshot || status.globalMetrics)
            }
            // === END BATCH 5E ===
          }
        } catch (err) {
          console.error('Status poll error:', err)
          if (err.status === 401 || err.status === 403) {
            clearInterval(simulationIntervalRef.current)
            simulationIntervalRef.current = null
            if (eventSourceRef.current) { eventSourceRef.current.abort(); eventSourceRef.current = null }
            stopSimulation()
            useCanvasStore.getState().setSimulationProgress(0)
            setSimulationId(null)
            setLogs(prev => [...prev, { type: 'error', message: 'Session expired. Please sign in again.', timestamp: Date.now() }])
          }
        }
      }, 2000)

    } catch (err) {
      stopSimulation()
      useCanvasStore.getState().setSimulationProgress(0)
      setLogs(prev => [...prev, { type: 'error', message: `Simulation failed: ${err.message}`, timestamp: Date.now() }])
    }
  }

  // Keyboard shortcuts — placed after all handlers it calls (deps evaluate at render).
  useEffect(() => {
    const handleKeyDown = (e) => {
      // BATCH 4: FOCUS GATE — Ignore all canvas shortcuts when editing text
      if (isEditingText()) {
        // Only allow Escape to clear focus when inside inputs
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          // Blur the active element to exit edit mode
          document.activeElement?.blur()
          // Return focus to canvas container
          canvasContainerRef.current?.focus()
          clearSelection()
          clearValidationHighlight()
        }
        return
      }

      if (e.metaKey || e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case 's': e.preventDefault(); handleManualSave(); break
          case 'e': e.preventDefault(); setShowExportModal(true); break
          case 'k': e.preventDefault(); setShowKeyboardShortcuts(true); break
          case 'z': e.preventDefault(); e.shiftKey ? canvasCommands.redo() : canvasCommands.undo(); break
          case 'y': e.preventDefault(); canvasCommands.redo(); break
          case 'a':
            if (e.shiftKey) break
            e.preventDefault()
            canvasCommands.selectAll()
            break
          // === P1: CMD+SHIFT+V = VALIDATE ===
          case 'v':
            if (e.shiftKey) {
              e.preventDefault()
              handleRunValidation(true)
            } else {
              e.preventDefault()
              canvasCommands.pasteClipboard()
            }
            break
          // === END P1 ===
          case 'c':
            if (e.shiftKey) break
            e.preventDefault()
            void canvasCommands.copySelection()
            break
          case 'd':
            if (e.shiftKey) break
            e.preventDefault()
            canvasCommands.duplicateSelection()
            break
        }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        canvasCommands.deleteSelection()
      }
      if (e.key === 'Escape') {
        clearSelection()
        clearValidationHighlight()
        setContextMenu(null)
        setActivePanel(null)
        setShowEdgeTypeMenu(false)
        setPendingConnection(null)
      }
      if (e.key === 'Enter') {
        if (selectedNodeId) openPropertiesFor('node', selectedNodeId)
        else if (selectedEdgeId) openPropertiesFor('edge', selectedEdgeId)
      }
      if (e.key === 'n' || e.key === 'N') {
        canvasCommands.openNodePicker()
      }
      if (e.key === '1') {
        canvasCommands.fitArchitecture()
      }
      if (e.key === 'f' || e.key === 'F') {
        canvasCommands.focusSelection()
      }
      if (e.key === 'd' || e.key === 'D') {
        canvasCommands.duplicateSelection()
      }
      if (e.key === ' ' && !isEditingText()) {
        e.preventDefault()
        handleRunSimulation()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedNodeId, selectedEdgeId, openPropertiesFor, clearSelection, clearValidationHighlight, handleManualSave, handleRunValidation, handleRunSimulation, canvasContainerRef, setShowExportModal, setShowKeyboardShortcuts])

  const SaveStatusIndicator = () => {
    const status = autoSaveStatus || saveStatus
    if (status === 'idle') return null
    const icons = {
      saving: <Loader2 size={14} className="animate-spin text-amber-500" />,
      saved: <CheckCircle2 size={14} className="text-green-500" />,
      error: <AlertCircle size={14} className="text-red-500" />
    }
    const labels = { saving: 'Saving...', saved: 'Saved', error: 'Save failed' }
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-resonance-bg-elevated/80 backdrop-blur-sm border border-resonance-border">
        {icons[status]}
        <span className={`text-xs font-medium ${status === 'saving' ? 'text-amber-500' : status === 'saved' ? 'text-green-500' : 'text-red-500'}`}>{labels[status]}</span>
      </div>
    )
  }

  const handleCreateAndSave = async () => {
    if (!newDesignName.trim()) return
    try {
      const design = await useDesignStore.getState().createDesign({ name: newDesignName })
      await saveCanvas(design.id, { nodes, edges })
      navigate(`/design/${design.id}`, { replace: true })
      setShowSaveNewModal(false)
      setNewDesignName('')
      setLogs(prev => [...prev, { type: 'success', message: 'Design created and saved', timestamp: Date.now() }])
    } catch (err) {
      setLogs(prev => [...prev, { type: 'error', message: `Failed: ${err.message}`, timestamp: Date.now() }])
    }
  }

  if (designLoading && !isInitialized) {
    return (
      <div className="h-screen flex items-center justify-center bg-resonance-canvas-bg">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={32} className="animate-spin text-resonance-accent" />
          <p className="text-resonance-text-secondary">Loading design...</p>
        </div>
      </div>
    )
  }

  const allConnectionTypes = getAllConnectionTypes()

  return (
    <div className="h-screen flex flex-col bg-resonance-canvas-bg">
      <TopToolbar
        designName={currentDesign?.name || 'Untitled Design'}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onSave={handleManualSave}
        onExport={() => setShowExportModal(true)}
        onShare={() => setShowShareModal(true)}
        simulationRunning={simulationRunning}
        onRunSimulation={handleRunSimulation}
        extraActions={
          <div className="flex items-center gap-2">
            <SaveStatusIndicator />
          </div>
        }
        centerContent={
          <SimulationControls
            onRun={handleRunSimulation}
            isRunning={simulationRunning}
            metrics={null}
            simulationId={simulationId}
          />
        }
      />

      {/* Canvas + floating overlays: panels never reserve grid width (Phase 9) */}
      <div
        className="flex-1 grid overflow-hidden"
        style={{
          gridTemplateColumns: `
            ${panels.blockLibrary.collapsed ? 48 : panels.blockLibrary.width}px
            1fr
          `,
        }}
      >
        <BlockLibrary
          collapsed={panels.blockLibrary.collapsed}
          onToggleCollapse={() => togglePanel('blockLibrary')}
        />

        <div
          ref={canvasContainerRef}
          className="relative min-h-0 min-w-0 outline-none"
          tabIndex={0}
          data-canvas-container="true"
          onFocus={() => { /* Canvas has focus — shortcuts enabled */ }}
        >
          <div className="w-full h-full">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChangeWrapper}
              onEdgesChange={onEdgesChangeWrapper}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onEdgeClick={onEdgeClick}
              onNodeDoubleClick={onNodeDoubleClick}
              onEdgeDoubleClick={onEdgeDoubleClick}
              onNodeContextMenu={onNodeContextMenu}
              onEdgeContextMenu={onEdgeContextMenu}
              onPaneContextMenu={onPaneContextMenu}
              onPaneClick={onPaneClick}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onNodeDragStop={onNodeDragStop}
              onNodesDelete={onNodesDelete}
              onEdgesDelete={onEdgesDelete}
              onSelectionChange={onSelectionChange}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              defaultEdgeOptions={edgeOptions}
              fitView
              attributionPosition="bottom-right"
              minZoom={0.1}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
              className="bg-resonance-canvas-bg"
              deleteKeyCode={null}
              selectionOnDrag={true}
              multiSelectionKeyCode={['Meta', 'Ctrl']}
              selectionMode={SelectionMode.Partial}
              snapToGrid={true}
              snapGrid={[20, 20]}
            >
              <Background color="var(--canvas-grid)" gap={20} size={1} variant="dots" />
              <Controls className="!bg-resonance-bg-elevated !border-resonance-border !rounded-xl !shadow-lg" showInteractive={false} />
              <MiniMap
                className="!bg-resonance-bg-elevated !border-resonance-border !rounded-xl !shadow-lg"
                nodeColor={(node) => node.data?.color || '#8b5cf6'}
                maskColor="rgba(0, 0, 0, 0.2)"
              />
            </ReactFlow>
          </div>

          <TopologyRiskOverlay
            findings={validationResult?.findings}
            highlightedBlockId={validationHighlight?.elementType === 'node' ? validationHighlight.elementId : null}
          />

          {isInitialized && nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2">
              <button
                onClick={() => canvasCommands.openNodePicker()}
                className="pointer-events-auto flex items-center gap-2 rounded-xl border border-resonance-border bg-resonance-bg-elevated px-4 py-2.5 text-sm font-medium text-resonance-text-secondary shadow-lg transition-all hover:border-resonance-accent hover:text-resonance-text-primary"
              >
                <Plus size={16} /> Add component
              </button>
              <p className="text-xs text-resonance-text-muted">Start building your architecture</p>
            </div>
          )}

          <div className="absolute bottom-20 right-4 z-10 flex flex-col gap-1">
            <button onClick={() => canvasCommands.openNodePicker()} className="w-8 h-8 rounded-xl bg-resonance-accent border border-resonance-accent flex items-center justify-center text-resonance-neutral hover:bg-resonance-accent-hover transition-all shadow-lg" title="Add component (N)">
              <Plus size={16} />
            </button>
            <button onClick={() => zoomIn({ duration: 300 })} className="w-8 h-8 rounded-xl bg-resonance-bg-elevated border border-resonance-border flex items-center justify-center text-resonance-text-secondary hover:text-resonance-text-primary hover:bg-resonance-bg-hover transition-all shadow-lg" title="Zoom In">
              <ZoomIn size={16} />
            </button>
            <button onClick={() => fitView({ duration: 500, padding: 0.2 })} className="w-8 h-8 rounded-xl bg-resonance-bg-elevated border border-resonance-border flex items-center justify-center text-resonance-text-secondary hover:text-resonance-text-primary hover:bg-resonance-bg-hover transition-all shadow-lg" title="Fit View">
              <Maximize size={16} />
            </button>
            <button onClick={() => zoomOut({ duration: 300 })} className="w-8 h-8 rounded-xl bg-resonance-bg-elevated border border-resonance-border flex items-center justify-center text-resonance-text-secondary hover:text-resonance-text-primary hover:bg-resonance-bg-hover transition-all shadow-lg" title="Zoom Out">
              <ZoomOut size={16} />
            </button>
          </div>

          {simulationRunning && <SimulationOverlay />}
          <SimulationBar
            onStop={() => handleRunSimulation()}
            onRetry={() => handleRunSimulation(useCanvasStore.getState().simulationConfig || {})}
            onViewReport={() => setShowReportModal(true)}
          />

          <div className="absolute bottom-4 left-4 z-10">
            <button
              onClick={() => setShowKeyboardShortcuts(true)}
              className="px-2 py-1 rounded-xl bg-resonance-bg-elevated/80 backdrop-blur-sm border border-resonance-border text-xs text-resonance-text-muted hover:text-resonance-text-secondary transition-colors"
            >
              Press ⌘K for shortcuts
            </button>
          </div>

          {showEdgeTypeMenu && pendingConnection && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-resonance-bg-elevated border border-resonance-border rounded-xl shadow-2xl p-4 min-w-[200px]">
              <p className="text-sm font-medium text-resonance-text-primary mb-3">Select Connection Type</p>
              <div className="space-y-1">
                {allConnectionTypes.map(type => (
                  <button
                    key={type.id}
                    onClick={() => handleCreateEdge(type.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-resonance-text-secondary hover:bg-resonance-bg-hover hover:text-resonance-text-primary transition-all"
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: type.color }} />
                    <span className="font-medium">{type.label}</span>
                    <span className="text-xs text-resonance-text-muted ml-auto">{type.id}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => { setShowEdgeTypeMenu(false); setPendingConnection(null) }}
                className="mt-2 w-full py-1.5 rounded-xl text-xs text-resonance-text-muted hover:text-resonance-text-secondary hover:bg-resonance-bg-hover transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Shared floating slot: properties OR validation, canvas never resizes */}
          {activePanel === 'properties' && (selectedNodeId || selectedEdgeId) && (
            <InspectorShell label="Properties" size="lg" onClose={() => setActivePanel(null)}>
              <PropertyPanel
                ref={propertyPanelRef}
                validationResult={validationResult}
                isValidating={isValidating}
                onRunValidation={() => handleRunValidation(true)}
              />
            </InspectorShell>
          )}
          {activePanel === 'validation' && (
            <InspectorShell
              label="Validation"
              size="lg"
              onClose={() => { setActivePanel(null); setShowValidationPanel(false) }}
            >
              <ValidationPanel
                validation={validationResult}
                onClose={() => { setActivePanel(null); setShowValidationPanel(false) }}
                onHighlightFinding={handleFindingClick}
                onClearHighlight={() => clearValidationHighlight()}
                onRunValidation={() => handleRunValidation(true)}
                isValidating={isValidating}
                onJumpToProperty={handleJumpToProperty}
              />
            </InspectorShell>
          )}
        </div>
      </div>

      <BottomPanel logs={logs} />
      <NodePicker />
      <CanvasContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} onConfigure={openPropertiesFor} />
      <ExportModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} nodes={nodes.filter(isBlockNode)} edges={edges} />

      {/* === BATCH 5E: SIMULATION REPORT MODAL === */}
      <SimulationReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        report={currentReport}
        isLoading={reportLoading}
      />
      {/* === END BATCH 5E === */}

      <Modal isOpen={showShareModal} onClose={() => setShowShareModal(false)} title="Share Design" size="sm">
        <div className="space-y-4">
          <p className="text-resonance-text-secondary text-sm">Share this design with your team or generate a public link.</p>
          <div className="flex gap-2">
            <input
              type="text"
              defaultValue={`https://resonance.dev/design/${id || 'new'}`}
              readOnly
              className="input-field flex-1 text-sm bg-resonance-bg-tertiary border border-resonance-border rounded-xl px-3 py-2 text-resonance-text-primary"
            />
            <Button variant="secondary" onClick={() => navigator.clipboard.writeText(`https://resonance.dev/design/${id || 'new'}`)}>Copy</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showKeyboardShortcuts} onClose={() => setShowKeyboardShortcuts(false)} title="Keyboard Shortcuts" size="sm">
        <div className="space-y-3">
          {[
            { keys: ['⌘', 'S'], action: 'Save design' },
            { keys: ['⌘', 'E'], action: 'Export design' },
            { keys: ['⌘', 'K'], action: 'Show shortcuts' },
            { keys: ['⌘', 'Z'], action: 'Undo' },
            { keys: ['⌘', '⇧', 'Z'], action: 'Redo' },
            { keys: ['⌘', 'A'], action: 'Select all' },
            { keys: ['⌘', 'C'], action: 'Copy selection' },
            { keys: ['⌘', 'V'], action: 'Paste' },
            { keys: ['⌘', 'D'], action: 'Duplicate selection' },
            { keys: ['⌘', '⇧', 'V'], action: 'Validate architecture' },
            { keys: ['Del'], action: 'Delete selected' },
            { keys: ['N'], action: 'Add component' },
            { keys: ['Enter'], action: 'Configure selected' },
            { keys: ['1'], action: 'Fit architecture' },
            { keys: ['F'], action: 'Focus selection' },
            { keys: ['D'], action: 'Duplicate selection' },
            { keys: ['Esc'], action: 'Clear selection / exit input' },
            { keys: ['Space'], action: 'Run/Stop simulation' },
          ].map((shortcut, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-resonance-border last:border-0">
              <span className="text-sm text-resonance-text-secondary">{shortcut.action}</span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, j) => (
                  <span key={j} className="px-2 py-0.5 bg-resonance-bg-tertiary border border-resonance-border rounded-lg text-xs font-mono text-resonance-text-primary">{key}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      <Modal isOpen={showSaveNewModal} onClose={() => setShowSaveNewModal(false)} title="Save New Design" size="sm">
        <div className="space-y-4">
          <p className="text-resonance-text-secondary text-sm">Give your design a name to save it to the cloud.</p>
          <input
            type="text"
            placeholder="e.g., E-Commerce Platform"
            value={newDesignName}
            onChange={(e) => setNewDesignName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateAndSave()}
            className="input-field w-full bg-resonance-bg-tertiary border border-resonance-border rounded-xl px-3 py-2 text-resonance-text-primary placeholder-resonance-text-muted focus:outline-none focus:border-resonance-accent"
            autoFocus
          />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowSaveNewModal(false)}>Cancel</Button>
            <Button onClick={handleCreateAndSave} disabled={!newDesignName.trim()}>Save Design</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export const CanvasEditor = () => (
  <ReactFlowProvider>
    <CanvasEditorInner />
  </ReactFlowProvider>
)