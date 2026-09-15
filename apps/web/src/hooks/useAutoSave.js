import { useEffect, useRef, useCallback } from 'react'
import { useDesignStore } from '@/stores/designStore'
import { useCanvasStore } from '@/stores/canvasStore'

const AUTOSAVE_DELAY = 10000
const MAX_RETRIES = 3

export const useAutoSave = (
  designId,
  nodes,
  edges,
  enabled = true,
  version = null
) => {
  const { autoSaveCanvas, saveStatus } = useDesignStore()

  const timeoutRef = useRef(null)
  const retryTimeoutRef = useRef(null)

  const lastSavedRef = useRef(null)
  const latestStateRef = useRef({ nodes: [], edges: [] })
  const versionRef = useRef(version)

  const retryCountRef = useRef(0)
  const isSavingRef = useRef(false)
  const dirtyRef = useRef(false)

  const serialize = useCallback((n, e) => {
    return JSON.stringify({
      nodes: (n || []).map(node => ({
        id: node.id,
        position: node.position,
        data: node.data,
        type: node.type,
      })),
      edges: (e || []).map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        data: edge.data,
        type: edge.type,
        animated: edge.animated,
      })),
    })
  }, [])

  /*
   * Keep the latest state in a ref.
   *
   * This is important because a save can take longer than the debounce
   * period. We never want a retry to save an old React closure.
   */
  useEffect(() => {
    latestStateRef.current = {
      nodes: nodes || [],
      edges: edges || [],
    }

    versionRef.current = version
  }, [nodes, edges, version])

  /*
   * Hydration establishes the baseline.
   *
   * This function must be called by CanvasEditor immediately after the
   * server successfully loads a design.
   */
  const markHydrated = useCallback((hydratedNodes, hydratedEdges, hydratedVersion) => {
    const snapshot = serialize(hydratedNodes || [], hydratedEdges || [])

    latestStateRef.current = {
      nodes: hydratedNodes || [],
      edges: hydratedEdges || [],
    }

    lastSavedRef.current = snapshot
    versionRef.current = hydratedVersion ?? null
    dirtyRef.current = false
    retryCountRef.current = 0
  }, [serialize])

  /*
   * Explicitly mark the canvas dirty after a REAL user change.
   *
   * We intentionally do not infer this from [] -> populated or [] -> [].
   */
  const markDirty = useCallback(() => {
    if (!enabled) return
    dirtyRef.current = true
  }, [enabled])

  const performSave = useCallback(async () => {
    if (
      !enabled ||
      !designId ||
      designId === 'new' ||
      !dirtyRef.current ||
      isSavingRef.current
    ) {
      return
    }

    const stateAtStart = latestStateRef.current
    const versionAtStart = versionRef.current

    isSavingRef.current = true

    try {
      await autoSaveCanvas(designId, {
        nodes: stateAtStart.nodes,
        edges: stateAtStart.edges,
        version: versionAtStart,
      })

      /*
       * Only mark this snapshot clean if the state has not changed while
       * the request was in flight.
       */
      const savedSnapshot = serialize(
        stateAtStart.nodes,
        stateAtStart.edges
      )

      const latestSnapshot = serialize(
        latestStateRef.current.nodes,
        latestStateRef.current.edges
      )

      if (savedSnapshot === latestSnapshot) {
        lastSavedRef.current = savedSnapshot
        dirtyRef.current = false

        /*
         * The backend increments the design version after a successful save.
         * If the response exposes the next version, use it.
         */
        const currentDesign = useDesignStore.getState().currentDesign

        if (currentDesign?.version != null) {
          versionRef.current = currentDesign.version
        }

        retryCountRef.current = 0
      } else {
        /*
         * User changed the canvas while the save was running.
         * Keep dirty=true so the newest state gets saved next.
         */
        dirtyRef.current = true
        retryCountRef.current = 0

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }

        timeoutRef.current = setTimeout(
          performSave,
          AUTOSAVE_DELAY
        )
      }
    } catch (err) {
      /*
       * Never convert a failed save into a successful state.
       */
      dirtyRef.current = true

      if (err?.status === 409) {
        /*
         * Revision conflict must NOT be blindly retried.
         * Another writer has changed the design.
         */
        retryCountRef.current = 0
        console.error(
          'Auto-save revision conflict. Save aborted to protect newer data.',
          err
        )
        return
      }

      retryCountRef.current += 1

      if (retryCountRef.current < MAX_RETRIES) {
        const retryDelay = AUTOSAVE_DELAY * retryCountRef.current

        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current)
        }

        retryTimeoutRef.current = setTimeout(() => {
          performSave()
        }, retryDelay)
      } else {
        console.error(
          'Auto-save failed after maximum retries:',
          err
        )
      }
    } finally {
      isSavingRef.current = false
    }
  }, [
    designId,
    enabled,
    autoSaveCanvas,
    serialize,
  ])

  /*
   * Debounce ONLY real dirty changes.
   */
  useEffect(() => {
    if (!enabled || !designId || designId === 'new') {
      return undefined
    }

    if (!dirtyRef.current) {
      return undefined
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(
      performSave,
      AUTOSAVE_DELAY
    )

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [
    nodes,
    edges,
    designId,
    enabled,
    performSave,
  ])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
    }
  }, [])

  return {
    saveStatus,
    markHydrated,
    markDirty,
    isDirty: dirtyRef.current,
  }
}