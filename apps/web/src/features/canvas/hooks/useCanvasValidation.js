import { useCallback, useEffect } from 'react'
import { useCanvasStore } from '@/stores/canvasStore'
import { api } from '@/services/api'
import { getValidationSummary, preValidateArchitecture } from '@/lib/validation'
import { mergeFindings } from '@/features/canvas/validation/validationAdapter'
import { createSimulationInput } from '@/features/canvas/simulation/simulationInputAdapter'
import { canvasCommands } from '@/features/canvas/core/canvasCommands'

// Validation shell (Phase 7/10). Client findings = fast local feedback,
// server = authoritative; merged by semantic key with the request revision.
// Stale responses (revision moved during await) are discarded. Moved from
// CanvasEditor; merge/dedupe now goes through the validation adapter.
export function useCanvasValidation({ designId, onShowValidation, onShowProperties, propertyPanelRef, pushLog } = {}) {
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const validationResult = useCanvasStore((s) => s.validationResult)
  const isValidating = useCanvasStore((s) => s.isValidating)

  const handleRunValidation = useCallback(async (showPanel = true) => {
    if (!designId || designId === 'new') return
    const requestedRevision = useCanvasStore.getState().revision
    useCanvasStore.getState().setIsValidating(true)
    if (showPanel) onShowValidation?.()

    const snapshot = () => {
      const st = useCanvasStore.getState()
      return createSimulationInput({ nodes: st.nodes, edges: st.edges })
    }

    try {
      // 1. Client-side pre-validation (instant feedback)
      const input = snapshot()
      const clientValidation = preValidateArchitecture(input.nodes, input.edges, null)

      // 2. Server-side validation (authoritative, over persisted design)
      const serverResult = await api.validateDesign(designId)

      // 3. Revision gate: edits during flight invalidate this response.
      if (useCanvasStore.getState().revision !== requestedRevision) return

      // 4. Semantic merge: same finding from both sources → one entry.
      const merged = mergeFindings(clientValidation.findings, serverResult.findings, requestedRevision)
      const result = {
        ...serverResult,
        ...merged,
        canSimulate: serverResult.canSimulate && clientValidation.canSimulate,
        clientPreValidated: true,
      }

      useCanvasStore.getState().setValidationResult(result, requestedRevision)
      pushLog?.({ type: result.canSimulate ? 'success' : 'error', message: getValidationSummary(result) })
    } catch (err) {
      // Fallback recomputed on current state (never the pre-await snapshot).
      const fresh = snapshot()
      const clientValidation = preValidateArchitecture(fresh.nodes, fresh.edges, null)
      const merged = mergeFindings(clientValidation.findings, [], useCanvasStore.getState().revision)
      useCanvasStore.getState().setValidationResult(
        { ...clientValidation, ...merged },
        useCanvasStore.getState().revision,
      )
      pushLog?.({ type: 'error', message: `Server validation failed, using client-side: ${err.message}` })
    } finally {
      useCanvasStore.getState().setIsValidating(false)
    }
  }, [designId, onShowValidation, pushLog])

  // Auto-validate (debounced) on document change.
  useEffect(() => {
    if (designId && designId !== 'new' && nodes.length > 0 && !isValidating) {
      const timer = setTimeout(() => {
        handleRunValidation(false)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [nodes, edges, designId, isValidating, handleRunValidation])

  // Finding click emphasizes + pans only — validation stays open.
  // Properties open explicitly via Jump to Property / node click.
  const handleFindingClick = useCallback((finding) => {
    canvasCommands.emphasizeFinding(finding)
  }, [])

  const handleJumpToProperty = useCallback((id, property, type) => {
    const st = useCanvasStore.getState()
    if (type === 'block') {
      const node = st.nodes.find((n) => n.id === id)
      if (node) {
        canvasCommands.selectNode(node.id)
        onShowProperties?.()
        // The PropertyPanel will receive the ref and scroll
        setTimeout(() => {
          propertyPanelRef?.current?.scrollToProperty?.(property)
        }, 100)
      }
    } else if (type === 'edge') {
      const edge = st.edges.find((e) => e.id === id)
      if (edge) {
        canvasCommands.selectEdge(edge.id)
        onShowProperties?.()
      }
    }
  }, [onShowProperties, propertyPanelRef])

  return {
    validationResult,
    isValidating,
    handleRunValidation,
    handleFindingClick,
    handleJumpToProperty,
  }
}
