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
  Handle,
  Position,
  useReactFlow,
  ReactFlowProvider,
  SelectionMode,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Play,
  Pause,
  Save,
  Download,
  Share2,
  GitBranch,
  MoreHorizontal,
  X,
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
import { animations } from '@/lib/anime'
import { blockIconMap } from '@/lib/iconMap'
import { BlockLibrary } from '@/components/canvas/BlockLibrary'
import { PropertyPanel } from '@/components/canvas/PropertyPanel'
import { TopToolbar } from '@/components/canvas/TopToolbar'
import { BottomPanel } from '@/components/canvas/BottomPanel'
import { SimulationOverlay } from '@/components/canvas/SimulationOverlay'
import { ExportModal } from '@/components/canvas/ExportModal'
import { CustomEdge } from '@/components/canvas/CustomEdge'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

const CustomBlockNode = ({ data, selected }) => {
  const IconComponent = blockIconMap[data.type] || blockIconMap['service']
  const color = data.color || '#8b5cf6'

  return (
    <div className={`relative group min-w-[160px] ${selected ? 'ring-2 ring-resonance-accent ring-offset-2 ring-offset-resonance-canvas-bg' : ''}`}>
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-resonance-accent !border-2 !border-resonance-canvas-bg" />
      <div className="bg-resonance-bg-elevated border border-resonance-border rounded-xl p-3 shadow-lg hover:shadow-xl transition-all duration-200" style={{ borderLeft: `3px solid ${color}` }}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
            <IconComponent size={16} style={{ color }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-resonance-text-primary truncate">{data.label}</p>
            <p className="text-xs text-resonance-text-muted capitalize">{data.type.replace(/-/g, ' ')}</p>
          </div>
        </div>
        {data.metrics && (
          <div className="mt-2 pt-2 border-t border-resonance-border space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-resonance-text-muted">RPS</span>
              <span className="text-resonance-text-primary font-medium">{data.metrics.rps}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-resonance-text-muted">Latency</span>
              <span className="text-resonance-text-primary font-medium">{data.metrics.latency}ms</span>
            </div>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-resonance-accent !border-2 !border-resonance-canvas-bg" />
    </div>
  )
}

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
    simulationRunning,
    activeTab,
    setNodes: setStoreNodes,
    setEdges: setStoreEdges,
    setSelectedNode,
    setSelectedNodes,
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
  } = useCanvasStore()

  const [nodes, setNodes, onNodesChange] = useNodesState(storeNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(storeEdges)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [logs, setLogs] = useState([])
  const [simulationProgress, setSimulationProgress] = useState(0)
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [showSaveNewModal, setShowSaveNewModal] = useState(false)
  const [newDesignName, setNewDesignName] = useState('')

  const { screenToFlowPosition, fitView, zoomIn, zoomOut } = useReactFlow()

  // Ref to prevent sync loops
  const isSyncingFromStore = useRef(false)
  const isSyncingToStore = useRef(false)

  // Auto-save hook
  const { saveStatus: autoSaveStatus } = useAutoSave(id, nodes, edges, id && id !== 'new')

  // Load design from backend
  useEffect(() => {
    const init = async () => {
      if (id && id !== 'new') {
        try {
          // Clear store first to prevent stale data sync
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

  // Sync store → local state (for drag-and-drop from BlockLibrary, undo/redo, etc.)
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

  // Sync local state → store (for auto-save, persistence, etc.)
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
          case 's': 
            e.preventDefault()
            handleManualSave()
            break
          case 'e': 
            e.preventDefault()
            setShowExportModal(true)
            break
          case 'k': 
            e.preventDefault()
            setShowKeyboardShortcuts(true)
            break
          case 'z':
            e.preventDefault()
            if (e.shiftKey) redo()
            else undo()
            break
          case 'y': 
            e.preventDefault()
            redo()
            break
          case 'a':
            if (e.shiftKey) break
            e.preventDefault()
            setSelectedNodes(nodes)
            break
        }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodes.length > 0) {
          deleteSelected()
        } else if (selectedNode) {
          removeNode(selectedNode.id)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedNode, selectedNodes, nodes, removeNode, deleteSelected, undo, redo])

  const onConnect = useCallback((params) => {
    const newEdge = { ...params, ...edgeOptions, id: `e-${Date.now()}` }
    setEdges((eds) => addEdge(newEdge, eds))
    addStoreEdge(params)
  }, [setEdges, addStoreEdge])

  const onNodeClick = useCallback((_, node) => {
    setSelectedNode(node)
  }, [setSelectedNode])

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
    setSelectedNodes([])
  }, [setSelectedNode, setSelectedNodes])

  const onSelectionChange = useCallback(({ nodes }) => {
    setSelectedNodes(nodes)
  }, [setSelectedNodes])

  const onDragOver = useCallback((event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback((event) => {
    event.preventDefault()
    const type = event.dataTransfer.getData('application/resonance-block')
    if (!type) return

    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    })

    const newNode = addNode(type, position)
    requestAnimationFrame(() => {
      setTimeout(() => {
        const el = document.querySelector(`[data-id="${newNode.id}"]`)
        if (el) animations.blockEnter(el)
      }, 100)
    })
  }, [screenToFlowPosition, addNode])

  const onNodeDragStop = useCallback((_, node) => {
    updateNodePosition(node.id, node.position)
  }, [updateNodePosition])

  const onNodesDelete = useCallback((deletedNodes) => {
    deletedNodes.forEach(node => removeNode(node.id))
  }, [removeNode])

  const onEdgesDelete = useCallback((deletedEdges) => {
    deletedEdges.forEach(edge => removeEdge(edge.id))
  }, [removeEdge])

  const handleManualSave = async () => {
    if (!id || id === 'new') {
      setShowSaveNewModal(true)
      return
    }
    try {
      await saveCanvas(id, { nodes, edges })
      setLogs(prev => [...prev, { type: 'success', message: 'Design saved to cloud', timestamp: Date.now() }])
    } catch (err) {
      setLogs(prev => [...prev, { type: 'error', message: `Save failed: ${err.message}`, timestamp: Date.now() }])
    }
  }

  const handleRunSimulation = () => {
    if (simulationRunning) { stopSimulation(); return }
    startSimulation()
    setLogs(prev => [...prev, { type: 'info', message: 'Starting simulation...', timestamp: Date.now() }])

    let progress = 0
    const interval = setInterval(() => {
      progress += 5
      setSimulationProgress(progress)
      if (progress >= 100) {
        clearInterval(interval)
        stopSimulation()
        setSimulationProgress(0)
        setLogs(prev => [...prev, { type: 'success', message: 'Simulation completed', timestamp: Date.now() }])
        const metrics = {
          totalRequests: Math.floor(Math.random() * 50000) + 10000,
          avgLatency: Math.floor(Math.random() * 100) + 20,
          p99Latency: Math.floor(Math.random() * 300) + 100,
          errorRate: (Math.random() * 5).toFixed(2),
          throughput: Math.floor(Math.random() * 2000) + 500,
          availability: (99 + Math.random()).toFixed(2),
          duration: 300,
        }
        setSimulationMetrics(metrics)
        nodes.forEach(node => {
          updateNode(node.id, {
            metrics: {
              rps: Math.floor(Math.random() * 1000) + 100,
              latency: Math.floor(Math.random() * 100) + 10,
              errors: Math.floor(Math.random() * 50),
            }
          })
        })
      }
    }, 150)
  }

  const SaveStatusIndicator = () => {
    const status = autoSaveStatus || saveStatus
    if (status === 'idle') return null

    const icons = {
      saving: <Loader2 size={14} className="animate-spin text-amber-500" />,
      saved: <CheckCircle2 size={14} className="text-green-500" />,
      error: <AlertCircle size={14} className="text-red-500" />,
    }

    const labels = {
      saving: 'Saving...',
      saved: 'Saved',
      error: 'Save failed',
    }

    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-resonance-bg-elevated/80 backdrop-blur-sm border border-resonance-border">
        {icons[status]}
        <span className={`text-xs font-medium ${
          status === 'saving' ? 'text-amber-500' : 
          status === 'saved' ? 'text-green-500' : 'text-red-500'
        }`}>
          {labels[status]}
        </span>
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
        extraActions={<SaveStatusIndicator />}
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
              <MiniMap className="!bg-resonance-bg-elevated !border-resonance-border !rounded-xl !shadow-lg" nodeColor={(node) => node.data?.color || '#8b5cf6'} maskColor="rgba(0, 0, 0, 0.2)" />
            </ReactFlow>
          </div>

          {/* Zoom Controls */}
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

          {simulationRunning && <SimulationOverlay progress={simulationProgress} />}

          <div className="absolute bottom-4 left-4 z-10">
            <button onClick={() => setShowKeyboardShortcuts(true)} className="px-2 py-1 rounded-lg bg-resonance-bg-elevated/80 backdrop-blur-sm border border-resonance-border text-xs text-resonance-text-muted hover:text-resonance-text-secondary transition-colors">
              Press ⌘K for shortcuts
            </button>
          </div>
        </div>

        <PropertyPanel />
      </div>

      <BottomPanel logs={logs} />

      <ExportModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} nodes={nodes} edges={edges} />

      <Modal isOpen={showShareModal} onClose={() => setShowShareModal(false)} title="Share Design" size="sm">
        <div className="space-y-4">
          <p className="text-resonance-text-secondary text-sm">Share this design with your team or generate a public link.</p>
          <div className="flex gap-2">
            <input type="text" value={`https://resonance.dev/design/${id || 'new'}`} readOnly className="input-field flex-1 text-sm" />
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
            className="input-field w-full"
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