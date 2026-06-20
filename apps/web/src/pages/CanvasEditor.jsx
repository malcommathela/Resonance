import React, { useEffect, useCallback, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  ReactFlowProvider,
  SelectionMode,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Play,
  Pause,
  GitBranch,
  ZoomIn,
  ZoomOut,
  Maximize,
  Loader2,
  CheckCircle2,
  AlertCircle,
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
import { AISuggestionsPanel } from '@/components/canvas/AISuggestionsPanel'
import { ExportModal } from '@/components/canvas/ExportModal'
import { CustomEdge } from '@/components/canvas/CustomEdge'
import { CustomBlockNode } from '@/components/canvas/CustomBlockNode'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'

const nodeTypes = { customBlock: CustomBlockNode }
const edgeTypes = { customEdge: CustomEdge }

const edgeOptions = {
  animated: true,
  style: { stroke: '#8b5cf6', strokeWidth: 2 },
  type: 'customEdge',
  data: { connectionType: 'http' },
}

function CanvasEditorInner() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { loadDesign, currentDesign, saveCanvas, saveStatus, isLoading: designLoading } = useDesignStore()
  const {
    nodes: storeNodes,
    edges: storeEdges,
    selectedNode,
    selectedNodes,
    selectedEdge,
    simulationRunning,
    activeTab,
    setNodes: setStoreNodes,
    setEdges: setStoreEdges,
    setSelectedNode,
    setSelectedNodes,
    setSelectedEdge,
    setActiveTab,
    addNode,
    updateNode,
    updateNodePosition,
    removeNode,
    addEdge: addStoreEdge,
    removeEdge,
    undo,
    redo,
    deleteSelected,
    startSimulation,
    stopSimulation,
    setSimulationMetrics,
    loadDesign: loadCanvasDesign,
    clearCanvas,
    getAllConnectionTypes,
  } = useCanvasStore()

  const [nodes, setNodes, onNodesChange] = useNodesState(storeNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(storeEdges)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [logs, setLogs] = useState([])
  const [simulationProgress, setSimulationProgress] = useState(0)
  const [simulationId, setSimulationId] = useState(null)
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [showSaveNewModal, setShowSaveNewModal] = useState(false)
  const [newDesignName, setNewDesignName] = useState('')
  const [showEdgeTypeMenu, setShowEdgeTypeMenu] = useState(false)
  const [pendingConnection, setPendingConnection] = useState(null)

  const { screenToFlowPosition, fitView, zoomIn, zoomOut } = useReactFlow()
  const eventSourceRef = useRef(null)
  const simulationIntervalRef = useRef(null)

  const isSyncingFromStore = useRef(false)
  const isSyncingToStore = useRef(false)

  const { saveStatus: autoSaveStatus } = useAutoSave(id, nodes, edges, id && id !== 'new')

  // Load design
  useEffect(() => {
    const init = async () => {
      if (id && id !== 'new') {
        try {
          clearCanvas()
          setNodes([])
          setEdges([])
          const design = await loadDesign(id)
          if (design.nodes?.length > 0 || design.edges?.length > 0) {
            isSyncingFromStore.current = true
            setNodes(design.nodes || [])
            setEdges(design.edges || [])
            loadCanvasDesign(design)
            setTimeout(() => { isSyncingFromStore.current = false }, 50)
          }
          setIsInitialized(true)
        } catch (err) {
          setLogs(prev => [...prev, { type: 'error', message: `Failed to load design: ${err.message}`, timestamp: Date.now() }])
          setIsInitialized(true)
        }
      } else {
        clearCanvas()
        setNodes([])
        setEdges([])
        setIsInitialized(true)
      }
    }
    init()
  }, [id, loadDesign, setNodes, setEdges, loadCanvasDesign, clearCanvas])

  // Sync store ↔ local state
  useEffect(() => {
    if (isSyncingToStore.current) return
    isSyncingFromStore.current = true
    setNodes(storeNodes)
    setTimeout(() => { isSyncingFromStore.current = false }, 0)
  }, [storeNodes, setNodes])

  useEffect(() => {
    if (isSyncingToStore.current) return
    isSyncingFromStore.current = true
    setEdges(storeEdges)
    setTimeout(() => { isSyncingFromStore.current = false }, 0)
  }, [storeEdges, setEdges])

  useEffect(() => {
    if (isSyncingFromStore.current) return
    isSyncingToStore.current = true
    setStoreNodes(nodes)
    setTimeout(() => { isSyncingToStore.current = false }, 0)
  }, [nodes, setStoreNodes])

  useEffect(() => {
    if (isSyncingFromStore.current) return
    isSyncingToStore.current = true
    setStoreEdges(edges)
    setTimeout(() => { isSyncingToStore.current = false }, 0)
  }, [edges, setStoreEdges])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case 's': e.preventDefault(); handleManualSave(); break
          case 'e': e.preventDefault(); setShowExportModal(true); break
          case 'k': e.preventDefault(); setShowKeyboardShortcuts(true); break
          case 'z': e.preventDefault(); e.shiftKey ? redo() : undo(); break
          case 'y': e.preventDefault(); redo(); break
          case 'a':
            if (e.shiftKey) break
            e.preventDefault()
            setSelectedNodes(nodes)
            break
        }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodes.length > 0) deleteSelected()
        else if (selectedNode) removeNode(selectedNode.id)
        else if (selectedEdge) removeEdge(selectedEdge.id)
      }
      if (e.key === ' ' && !e.target.matches('input, textarea, [contenteditable]')) {
        e.preventDefault()
        handleRunSimulation()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedNode, selectedNodes, selectedEdge, nodes, removeNode, removeEdge, deleteSelected, undo, redo])

  // Edge connection with type selection
  const onConnect = useCallback((params) => {
    // Show type selector instead of immediately creating
    setPendingConnection(params)
    setShowEdgeTypeMenu(true)
  }, [])

  const handleCreateEdge = useCallback((type) => {
    if (!pendingConnection) return
    const newEdge = { ...pendingConnection, ...edgeOptions, id: `e-${Date.now()}`, data: { connectionType: type } }
    setEdges((eds) => addEdge(newEdge, eds))
    addStoreEdge(pendingConnection, type)
    setPendingConnection(null)
    setShowEdgeTypeMenu(false)
  }, [pendingConnection, setEdges, addStoreEdge])

  const onNodeClick = useCallback((_, node) => setSelectedNode(node), [setSelectedNode])
  const onEdgeClick = useCallback((_, edge) => setSelectedEdge(edge), [setSelectedEdge])
  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
    setSelectedNodes([])
    setSelectedEdge(null)
    setShowEdgeTypeMenu(false)
  }, [setSelectedNode, setSelectedNodes, setSelectedEdge])

  const onSelectionChange = useCallback(({ nodes, edges }) => {
    setSelectedNodes(nodes)
    if (edges?.length > 0) setSelectedEdge(edges[0])
  }, [setSelectedNodes, setSelectedEdge])

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

  const onNodeDragStop = useCallback((_, node) => updateNodePosition(node.id, node.position), [updateNodePosition])
  const onNodesDelete = useCallback((deletedNodes) => deletedNodes.forEach(node => removeNode(node.id)), [removeNode])
  const onEdgesDelete = useCallback((deletedEdges) => deletedEdges.forEach(edge => removeEdge(edge.id)), [removeEdge])

  const handleManualSave = async () => {
    if (!id || id === 'new') { setShowSaveNewModal(true); return }
    try {
      await saveCanvas(id, { nodes, edges })
      setLogs(prev => [...prev, { type: 'success', message: 'Design saved to cloud', timestamp: Date.now() }])
    } catch (err) {
      setLogs(prev => [...prev, { type: 'error', message: `Save failed: ${err.message}`, timestamp: Date.now() }])
    }
  }

  // === REAL SIMULATION INTEGRATION ===
  const handleRunSimulation = async (config = {}) => {
    if (simulationRunning) {
      if (simulationId) {
        try { await api.stopSimulation(simulationId) } catch (e) { /* ignore */ }
      }
      stopSimulation()
      if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null }
      if (simulationIntervalRef.current) { clearInterval(simulationIntervalRef.current); simulationIntervalRef.current = null }
      setSimulationProgress(0)
      setSimulationId(null)
      return
    }

    if (!id || id === 'new') {
      setLogs(prev => [...prev, { type: 'warning', message: 'Save design before running simulation', timestamp: Date.now() }])
      setShowSaveNewModal(true)
      return
    }

    startSimulation()
    setLogs(prev => [...prev, { type: 'info', message: 'Starting simulation...', timestamp: Date.now() }])
    setSimulationProgress(0)

    try {
      const result = await api.runSimulation(id, {
        trafficPattern: config.trafficPattern || 'steady',
        rps: config.rps || 100,
        duration: config.duration || 300,
        scenario: config.scenario || 'none',
      })

      const simId = result.simulationId
      setSimulationId(simId)
      setLogs(prev => [...prev, { type: 'success', message: `Simulation ${simId} started`, timestamp: Date.now() }])

      // SSE stream
      const es = new EventSource(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/simulations/${simId}/stream`,
        { withCredentials: true }
      )

      es.onmessage = (event) => {
        const data = JSON.parse(event.data)
        setSimulationProgress(data.progress || 0)

        if (data.metrics) {
          Object.entries(data.metrics).forEach(([blockId, metrics]) => {
            updateNode(blockId, {
              metrics: {
                rps: metrics.throughput || 0,
                latency: Math.round(metrics.avgLatency || 0),
                errors: metrics.totalFailed || 0,
                utilization: metrics.utilization || 0,
                p95Latency: Math.round(metrics.p95Latency || 0),
                p99Latency: Math.round(metrics.p99Latency || 0),
                queueDepth: metrics.queueDepth || 0,
              }
            })
          })
        }

        if (data.global) {
          setSimulationMetrics({
            totalRequests: data.global.totalRequests || 0,
            avgLatency: data.global.avgLatency || 0,
            p99Latency: 0,
            errorRate: data.global.totalRequests > 0
              ? ((data.global.totalErrors / data.global.totalRequests) * 100).toFixed(2)
              : '0.00',
            throughput: data.global.totalRequests / (config.duration || 300),
            availability: data.global.totalRequests > 0
              ? (((data.global.totalRequests - data.global.totalErrors) / data.global.totalRequests) * 100).toFixed(2)
              : '100.00',
            duration: config.duration || 300,
          })
        }

        if (data.currentRps && data.currentRps > (config.rps || 100) * 10) {
          setLogs(prev => [...prev, { type: 'warning', message: `Traffic spike: ${Math.round(data.currentRps)} RPS`, timestamp: Date.now() }])
        }
      }

      es.onerror = () => { es.close(); eventSourceRef.current = null }
      eventSourceRef.current = es

      // Poll for completion
      simulationIntervalRef.current = setInterval(async () => {
        try {
          const status = await api.getSimulationStatus(simId)
          if (status.status === 'completed' || status.status === 'stopped') {
            clearInterval(simulationIntervalRef.current)
            simulationIntervalRef.current = null
            if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null }
            stopSimulation()
            setSimulationProgress(100)
            setSimulationId(null)

            if (status.metrics) {
              setSimulationMetrics({
                totalRequests: status.metrics.totalRequests || 0,
                avgLatency: Math.round(status.metrics.avgLatency || 0),
                p99Latency: Math.round(status.metrics.p99Latency || 0),
                errorRate: (status.metrics.errorRate || 0).toFixed(2),
                throughput: Math.round(status.metrics.throughput || 0),
                availability: (status.metrics.availability || 100).toFixed(2),
                duration: status.metrics.duration || (config.duration || 300),
              })
            }

            setLogs(prev => [...prev, { type: 'success', message: `Simulation completed — ${status.metrics?.totalRequests?.toLocaleString() || 'N/A'} requests`, timestamp: Date.now() }])

            if (status.metrics && (status.metrics.errorRate > 1 || status.metrics.avgLatency > 200)) {
              setShowSuggestions(true)
            }
          }
        } catch (err) { console.error('Status poll error:', err) }
      }, 2000)

    } catch (err) {
      stopSimulation()
      setSimulationProgress(0)
      setLogs(prev => [...prev, { type: 'error', message: `Simulation failed: ${err.message}`, timestamp: Date.now() }])
    }
  }

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close()
      if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current)
    }
  }, [])

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
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-resonance-bg-elevated/80 backdrop-blur-sm border border-resonance-border">
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
            <button
              onClick={() => setShowSuggestions(true)}
              className="p-2 rounded-lg hover:bg-resonance-bg-hover text-resonance-text-secondary hover:text-resonance-accent transition-colors"
              title="AI Suggestions"
            >
              <GitBranch size={16} />
            </button>
          </div>
        }
        centerContent={
          <SimulationControls
            onRun={handleRunSimulation}
            isRunning={simulationRunning}
            progress={simulationProgress}
            metrics={null}
            simulationId={simulationId}
          />
        }
      />

      <div className="flex-1 flex overflow-hidden">
        <BlockLibrary />
        <div className="flex-1 relative min-h-0">
          <div className="w-full h-full">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onEdgeClick={onEdgeClick}
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
              deleteKeyCode={['Delete', 'Backspace']}
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

          {/* Zoom controls */}
          <div className="absolute bottom-20 right-4 z-10 flex flex-col gap-1">
            <button onClick={() => zoomIn({ duration: 300 })} className="w-8 h-8 rounded-lg bg-resonance-bg-elevated border border-resonance-border flex items-center justify-center text-resonance-text-secondary hover:text-resonance-text-primary hover:bg-resonance-bg-hover transition-all shadow-lg" title="Zoom In">
              <ZoomIn size={16} />
            </button>
            <button onClick={() => fitView({ duration: 500, padding: 0.2 })} className="w-8 h-8 rounded-lg bg-resonance-bg-elevated border border-resonance-border flex items-center justify-center text-resonance-text-secondary hover:text-resonance-text-primary hover:bg-resonance-bg-hover transition-all shadow-lg" title="Fit View">
              <Maximize size={16} />
            </button>
            <button onClick={() => zoomOut({ duration: 300 })} className="w-8 h-8 rounded-lg bg-resonance-bg-elevated border border-resonance-border flex items-center justify-center text-resonance-text-secondary hover:text-resonance-text-primary hover:bg-resonance-bg-hover transition-all shadow-lg" title="Zoom Out">
              <ZoomOut size={16} />
            </button>
          </div>

          {/* Simulation overlay */}
          {simulationRunning && <SimulationOverlay progress={simulationProgress} />}

          {/* Keyboard shortcuts hint */}
          <div className="absolute bottom-4 left-4 z-10">
            <button
              onClick={() => setShowKeyboardShortcuts(true)}
              className="px-2 py-1 rounded-lg bg-resonance-bg-elevated/80 backdrop-blur-sm border border-resonance-border text-xs text-resonance-text-muted hover:text-resonance-text-secondary transition-colors"
            >
              Press ⌘K for shortcuts
            </button>
          </div>

          {/* Edge type selector popup */}
          {showEdgeTypeMenu && pendingConnection && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-resonance-bg-elevated border border-resonance-border rounded-xl shadow-2xl p-4 min-w-[200px]">
              <p className="text-sm font-medium text-resonance-text-primary mb-3">Select Connection Type</p>
              <div className="space-y-1">
                {allConnectionTypes.map(type => (
                  <button
                    key={type.id}
                    onClick={() => handleCreateEdge(type.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-resonance-text-secondary hover:bg-resonance-bg-hover hover:text-resonance-text-primary transition-all"
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: type.color }} />
                    <span className="font-medium">{type.label}</span>
                    <span className="text-xs text-resonance-text-muted ml-auto">{type.id}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => { setShowEdgeTypeMenu(false); setPendingConnection(null) }}
                className="mt-2 w-full py-1.5 rounded-lg text-xs text-resonance-text-muted hover:text-resonance-text-secondary hover:bg-resonance-bg-hover transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
        <PropertyPanel />
      </div>

      <BottomPanel logs={logs} />
      <ExportModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} nodes={nodes} edges={edges} />
      <AISuggestionsPanel
        isOpen={showSuggestions}
        onClose={() => setShowSuggestions(false)}
        designId={id}
        simulationId={simulationId}
        onApply={(result) => {
          setLogs(prev => [...prev, { type: 'success', message: `Applied: ${result.message}`, timestamp: Date.now() }])
          if (id && id !== 'new') loadDesign(id)
        }}
      />

      {/* Share Modal */}
      <Modal isOpen={showShareModal} onClose={() => setShowShareModal(false)} title="Share Design" size="sm">
        <div className="space-y-4">
          <p className="text-resonance-text-secondary text-sm">Share this design with your team or generate a public link.</p>
          <div className="flex gap-2">
            <input
              type="text"
              defaultValue={`https://resonance.dev/design/${id || 'new'}`}
              readOnly
              className="input-field flex-1 text-sm bg-resonance-bg-tertiary border border-resonance-border rounded-lg px-3 py-2 text-resonance-text-primary"
            />
            <Button variant="secondary" onClick={() => navigator.clipboard.writeText(`https://resonance.dev/design/${id || 'new'}`)}>Copy</Button>
          </div>
        </div>
      </Modal>

      {/* Keyboard Shortcuts Modal */}
      <Modal isOpen={showKeyboardShortcuts} onClose={() => setShowKeyboardShortcuts(false)} title="Keyboard Shortcuts" size="sm">
        <div className="space-y-3">
          {[
            { keys: ['⌘', 'S'], action: 'Save design' },
            { keys: ['⌘', 'E'], action: 'Export design' },
            { keys: ['⌘', 'K'], action: 'Show shortcuts' },
            { keys: ['⌘', 'Z'], action: 'Undo' },
            { keys: ['⌘', '⇧', 'Z'], action: 'Redo' },
            { keys: ['⌘', 'A'], action: 'Select all' },
            { keys: ['Del'], action: 'Delete selected' },
            { keys: ['Space'], action: 'Run/Stop simulation' },
          ].map((shortcut, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-resonance-border last:border-0">
              <span className="text-sm text-resonance-text-secondary">{shortcut.action}</span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, j) => (
                  <span key={j} className="px-2 py-0.5 bg-resonance-bg-tertiary border border-resonance-border rounded text-xs font-mono text-resonance-text-primary">{key}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* Save New Design Modal */}
      <Modal isOpen={showSaveNewModal} onClose={() => setShowSaveNewModal(false)} title="Save New Design" size="sm">
        <div className="space-y-4">
          <p className="text-resonance-text-secondary text-sm">Give your design a name to save it to the cloud.</p>
          <input
            type="text"
            placeholder="e.g., E-Commerce Platform"
            value={newDesignName}
            onChange={(e) => setNewDesignName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateAndSave()}
            className="input-field w-full bg-resonance-bg-tertiary border border-resonance-border rounded-lg px-3 py-2 text-resonance-text-primary placeholder-resonance-text-muted focus:outline-none focus:border-resonance-accent"
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