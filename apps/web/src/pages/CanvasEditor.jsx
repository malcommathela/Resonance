import React, { useEffect, useCallback, useState } from 'react'
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
} from 'lucide-react'
import { useCanvasStore } from '@/stores/canvasStore'
import { useDesignStore } from '@/stores/designStore'
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
  const { getDesignById } = useDesignStore()
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
  } = useCanvasStore()

  const [nodes, setNodes, onNodesChange] = useNodesState(storeNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(storeEdges)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [logs, setLogs] = useState([])
  const [simulationProgress, setSimulationProgress] = useState(0)
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false)

  const { screenToFlowPosition, fitView, zoomIn, zoomOut } = useReactFlow()

  // Sync store → local state
  useEffect(() => { setNodes(storeNodes) }, [storeNodes, setNodes])
  useEffect(() => { setEdges(storeEdges) }, [storeEdges, setEdges])

  // Load design
  useEffect(() => {
    if (id && id !== 'new') {
      const design = getDesignById(id)
      if (design?.nodes?.length) {
        setNodes(design.nodes)
        setEdges(design.edges || [])
      }
    }
  }, [id, getDesignById, setNodes, setEdges])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case 's': e.preventDefault(); handleSave(); break
          case 'e': e.preventDefault(); setShowExportModal(true); break
          case 'k': e.preventDefault(); setShowKeyboardShortcuts(true); break
          case 'z':
            e.preventDefault()
            if (e.shiftKey) redo()
            else undo()
            break
          case 'y': e.preventDefault(); redo(); break
          case 'a':
            if (e.shiftKey) break // Let Shift+Ctrl+A pass through
            e.preventDefault()
            // Select all nodes
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

  const onSelectionChange = useCallback(({ nodes, edges }) => {
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

  const handleSave = () => {
    setStoreNodes(nodes)
    setStoreEdges(edges)
    setLogs(prev => [...prev, { type: 'success', message: 'Design saved', timestamp: Date.now() }])
  }

  const design = id && id !== 'new' ? getDesignById(id) : null

  return (
    <div className="h-screen flex flex-col bg-resonance-canvas-bg">
      <TopToolbar
        designName={design?.name || 'Untitled Design'}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onSave={handleSave}
        onExport={() => setShowExportModal(true)}
        onShare={() => setShowShareModal(true)}
        simulationRunning={simulationRunning}
        onRunSimulation={handleRunSimulation}
      />

      <div className="flex-1 flex overflow-hidden">
        <BlockLibrary />

        <div className="flex-1 relative">
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
    </div>
  )
}

export const CanvasEditor = () => (
  <ReactFlowProvider>
    <CanvasEditorInner />
  </ReactFlowProvider>
)