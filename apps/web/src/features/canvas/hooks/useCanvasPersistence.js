import { useCallback, useEffect, useState } from 'react'
import { useCanvasStore } from '@/stores/canvasStore'
import { useDesignStore } from '@/stores/designStore'
import { useAutoSave } from '@/hooks/useAutoSave'
import { normalizeDocument } from '@/features/canvas/core/document'
import { persistCanvasMeta } from '@/features/canvas/groups/meta'
import { saveCanvasDocument } from '@/features/canvas/persistence/canvasPersistence'

// Persistence shell (Phase 8/10). Owns load, autosave wiring, group-meta
// persistence, and manual save. The UI decides WHEN; canvasPersistence decides
// WHAT goes WHERE. Saves are revision-tagged: stale completions never clear
// dirty. Moved from CanvasEditor; behavior identical.
export function useCanvasPersistence({ designId, onRequireSaveAs, pushLog } = {}) {
  const { loadDesign, currentDesign, saveCanvas, saveStatus, isLoading: designLoading } = useDesignStore()
  const loadCanvasDesign = useCanvasStore((s) => s.loadDesign)
  const clearCanvas = useCanvasStore((s) => s.clearCanvas)

  const [isInitialized, setIsInitialized] = useState(false)

  const {
    saveStatus: autoSaveStatus,
    markHydrated,
    markDirty,
  } = useAutoSave(
    designId,
    useCanvasStore((s) => s.nodes),
    useCanvasStore((s) => s.edges),
    Boolean(designId && designId !== 'new' && isInitialized),
    currentDesign?.version ?? null,
  )

  // Inspector/store edits set store isDirty without touching RF — bridge that
  // into autosave so config edits persist.
  const storeDirty = useCanvasStore((s) => s.isDirty)
  useEffect(() => {
    if (storeDirty) markDirty()
  }, [storeDirty, markDirty])

  // Persist canvas-only objects (groups) per design; blocks/edges keep
  // flowing through the existing autosave pipeline.
  const metaNodes = useCanvasStore((s) => s.nodes)
  useEffect(() => {
    if (designId && designId !== 'new' && isInitialized) persistCanvasMeta(designId, metaNodes)
  }, [designId, isInitialized, metaNodes])

  // Load design (verbatim lifecycle: never clear before server responds,
  // never initialize after a failed load — [] must not become autosaveable).
  useEffect(() => {
    let cancelled = false

    const init = async () => {
      if (designId && designId !== 'new') {
        setIsInitialized(false)

        try {
          const design = await loadDesign(designId)

          if (cancelled) return

          const loadedNodes = design?.nodes || []
          const loadedEdges = design?.edges || []

          // Hydrate the document store from the server snapshot.
          loadCanvasDesign(normalizeDocument({
            ...design,
            nodes: loadedNodes,
            edges: loadedEdges,
          }))

          // Canvas-only objects (groups) rejoin from local storage,
          // then the full canvas state becomes the clean baseline.
          useCanvasStore.getState().loadCanvasMeta(designId)
          const hydrated = useCanvasStore.getState()

          markHydrated(hydrated.nodes, hydrated.edges, design?.version ?? null)
          useCanvasStore.getState().markCanvasClean()

          setIsInitialized(true)
        } catch (err) {
          if (cancelled) return
          setIsInitialized(false)
          pushLog?.({ type: 'error', message: `Failed to load design: ${err.message}` })
          console.error('Failed to load design:', err)
        }

        return
      }

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
  }, [designId, loadDesign, loadCanvasDesign, clearCanvas, markHydrated, pushLog])

  const handleManualSave = useCallback(async () => {
    if (!designId || designId === 'new') { onRequireSaveAs?.(); return }
    try {
      const st = useCanvasStore.getState()
      await saveCanvasDocument(designId, { nodes: st.nodes, edges: st.edges, revision: st.revision }, saveCanvas)
      pushLog?.({ type: 'success', message: 'Design saved to cloud' })
    } catch (err) {
      pushLog?.({ type: 'error', message: `Save failed: ${err.message}` })
    }
  }, [designId, saveCanvas, onRequireSaveAs, pushLog])

  return {
    isInitialized,
    designLoading,
    currentDesign,
    saveStatus,
    autoSaveStatus,
    markDirty,
    handleManualSave,
  }
}
