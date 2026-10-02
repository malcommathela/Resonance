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
import { useApiWithAuth } from '@/services/api'
import { ValidationPanel } from '@/components/canvas/ValidationPanel'
import { TopologyRiskOverlay } from '@/components/canvas/TopologyRiskOverlay'
import { useCanvasDocument } from '@/features/canvas/core/useCanvasDocument'
import { isBlockNode } from '@/features/canvas/core/document'
import { nodeTypes, edgeTypes } from '@/features/canvas/core/canvasTypes'
import { canvasCommands } from '@/features/canvas/core/canvasCommands'
import { setFlowInstance } from '@/features/canvas/core/flowInstance'
import { useCanvasSelection } from '@/features/canvas/hooks/useCanvasSelection'
import { useCanvasValidation } from '@/features/canvas/hooks/useCanvasValidation'
import { useCanvasPersistence } from '@/features/canvas/hooks/useCanvasPersistence'
import { useCanvasGroups } from '@/features/canvas/hooks/useCanvasGroups'
import { useCanvasSimulationBridge } from '@/features/canvas/hooks/useCanvasSimulationBridge'
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

  // Editor-owned local UI state. Feature hooks receive callbacks, never this.
  const [showExportModal, setShowExportModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [logs, setLogs] = useState([])
  const pushLog = useCallback((entry) => setLogs((prev) => [...prev, { ...entry, timestamp: Date.now() }]), [])
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false)
  const [showSaveNewModal, setShowSaveNewModal] = useState(false)
  const [newDesignName, setNewDesignName] = useState('')
  const [showEdgeTypeMenu, setShowEdgeTypeMenu] = useState(false)
  const [pendingConnection, setPendingConnection] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const propertyPanelRef = useRef(null)
  // === BATCH 4: CANVAS CONTAINER REF FOR FOCUS MANAGEMENT ===
  const canvasContainerRef = useRef(null)
  // === END BATCH 4 ===

  // Shared floating slot: one overlay — 'properties' OR 'validation', never both.
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

  // === CANVAS FOUNDATION SHELL ===
  // Each hook owns one responsibility; this component initializes the canvas,
  // renders React Flow, composes panels, and wires high-level commands.
  const {
    isInitialized, designLoading, currentDesign, saveStatus, autoSaveStatus,
    markDirty, handleManualSave,
  } = useCanvasPersistence({
    designId: id,
    onRequireSaveAs: () => setShowSaveNewModal(true),
    pushLog,
  })
  const {
    selectedNodeId, selectedEdgeId, validationHighlight,
    openPropertiesFor,
    onNodeClick, onEdgeClick, onNodeDoubleClick, onEdgeDoubleClick,
    onNodeContextMenu, onEdgeContextMenu, onPaneContextMenu, onSelectionChange,
  } = useCanvasSelection({
    onShowProperties: () => setActivePanel('properties'),
    onShowContextMenu: setContextMenu,
  })
  const {
    validationResult, isValidating,
    handleRunValidation, handleFindingClick, handleJumpToProperty,
  } = useCanvasValidation({
    designId: id,
    onShowValidation: () => { setActivePanel('validation'); setShowValidationPanel(true) },
    onShowProperties: () => setActivePanel('properties'),
    propertyPanelRef,
    pushLog,
  })
  const {
    onDragOver, onDrop,
    onNodeDragStart, onNodeDrag, onNodeDragStop,
    onNodesDelete, onEdgesDelete,
  } = useCanvasGroups({ markDirty })
  const {
    simulationRunning, simulationId,
    showReportModal, setShowReportModal, currentReport, reportLoading,
    handleRunSimulation,
  } = useCanvasSimulationBridge({
    designId: id,
    onValidationBlocked: (preflight) => {
      if (preflight) {
        const st = useCanvasStore.getState()
        st.setValidationResult(preflight, st.revision)
      }
      setActivePanel('validation')
    },
    onRequireSaveAs: () => setShowSaveNewModal(true),
    pushLog,
  })

  // Phase 11: selective subscriptions — sim ticks touch only runtime maps,
  // so the editor shell no longer re-renders on every simulation update.
  const activeTab = useCanvasStore((s) => s.activeTab)
  const panels = useCanvasStore((s) => s.panels)
  const togglePanel = useCanvasStore((s) => s.togglePanel)
  const setActiveTab = useCanvasStore((s) => s.setActiveTab)
  const getAllConnectionTypes = useCanvasStore((s) => s.getAllConnectionTypes)

  const { nodes, edges, handleNodesChange, handleEdgesChange } = useCanvasDocument()

  const reactFlow = useReactFlow()
  const { fitView, zoomIn, zoomOut } = reactFlow
  useEffect(() => {
    setFlowInstance(reactFlow)
    return () => setFlowInstance(null)
  }, [reactFlow])

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

  // Phase 14: dev-only architecture diagnostics (never in production).
  // Signature-deduped: drag frames churn nodes/edges identity without
  // changing the issue set, so only new signatures warn.
  const diagSigRef = useRef(null)
  useEffect(() => {
    if (!import.meta.env.DEV) return
    let cancelled = false
    import('@/features/canvas/diagnostics/canvasDiagnostics').then(({ diagnoseDocument }) => {
      if (cancelled) return
      const issues = diagnoseDocument({ nodes, edges })
      const sig = JSON.stringify(issues.map((i) => i.code + ':' + (i.nodeId || i.edgeId || '')))
      if (sig !== diagSigRef.current) {
        diagSigRef.current = sig
        if (issues.length) console.warn('[canvas diagnostic]', issues)
      }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [nodes, edges])

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

  // Edge connection with type selection (stays: edge-type menu is editor-local UI).
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

  // Pane click orchestrates menus/panels/focus as well as clearing
  // selection + emphasis, so it stays in the shell.
  const onPaneClick = useCallback(() => {
    canvasCommands.clearSelection()
    setShowEdgeTypeMenu(false)
    setPendingConnection(null)
    canvasCommands.clearEmphasis()
    setContextMenu(null)
    if (activePanel === 'properties') setActivePanel(null)
    // BATCH 4: Return focus to canvas container so shortcuts work
    canvasContainerRef.current?.focus()
  }, [activePanel])

  // === END BATCH 4 ===

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
          canvasCommands.clearSelection()
          canvasCommands.clearEmphasis()
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
        canvasCommands.clearSelection()
        canvasCommands.clearEmphasis()
        setContextMenu(null)
        setActivePanel(null)
        setShowEdgeTypeMenu(false)
        setPendingConnection(null)
      }
      if (e.key === 'Enter') {
        if (selectedNodeId) {
          const n = useCanvasStore.getState().nodes.find((x) => x.id === selectedNodeId)
          if (n?.type === 'customBlock') openPropertiesFor('node', selectedNodeId)
        }
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
  }, [selectedNodeId, selectedEdgeId, openPropertiesFor, handleManualSave, handleRunValidation, handleRunSimulation])

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
      const st = useCanvasStore.getState()
      await useDesignStore.getState().saveCanvas(design.id, { nodes, edges, revision: st.revision })
      navigate(`/design/${design.id}`, { replace: true })
      setShowSaveNewModal(false)
      setNewDesignName('')
      pushLog({ type: 'success', message: 'Design created and saved' })
    } catch (err) {
      pushLog({ type: 'error', message: `Failed: ${err.message}` })
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
              onNodeDragStart={onNodeDragStart}
              onNodeDrag={onNodeDrag}
              onNodeDragStop={onNodeDragStop}
              elevateNodesOnSelect={false}
              zIndexMode="manual"
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
                nodeColor={(node) => (node.type === 'group' ? '#71717a' : (node.data?.color || '#8b5cf6'))}
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
            <InspectorShell label="Properties" size="sm" onClose={() => setActivePanel(null)}>
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
                size="sm"
              onClose={() => { setActivePanel(null); setShowValidationPanel(false) }}
            >
              <ValidationPanel
                validation={validationResult}
                onClose={() => { setActivePanel(null); setShowValidationPanel(false) }}
                onHighlightFinding={handleFindingClick}
                onClearHighlight={() => canvasCommands.clearEmphasis()}
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