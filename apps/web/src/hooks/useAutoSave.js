import { useEffect, useRef, useCallback } from 'react'
import { useDesignStore, serverVersionOrigin } from '@/stores/designStore'
import { useCanvasStore } from '@/stores/canvasStore'
import { shouldRetryAfterConflict } from '@/features/canvas/persistence/canvasPersistence'
import { api } from '@/services/api'

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

  const latestStateRef = useRef({ nodes: [], edges: [] })
  const versionRef = useRef(version)

  const retryCountRef = useRef(0)
  const isSavingRef = useRef(false)
  const dirtyRef = useRef(false)

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

    // Monotonic: the 409 path may have refreshed to a NEWER base version than
    // the prop (currentDesign only advances on successful save). Never slide
    // back — markHydrated is the explicit reset point on design load.
    if (version != null) {
      versionRef.current = Math.max(versionRef.current ?? version, version)
    }
  }, [nodes, edges, version])

  /*
   * Hydration establishes the baseline.
   *
   * This function must be called by CanvasEditor immediately after the
   * server successfully loads a design.
   */
  const markHydrated = useCallback((hydratedNodes, hydratedEdges, hydratedVersion) => {
    latestStateRef.current = {
      nodes: hydratedNodes || [],
      edges: hydratedEdges || [],
    }

    versionRef.current = hydratedVersion ?? null
    dirtyRef.current = false
    retryCountRef.current = 0
  }, [])

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
    // Revision-tagged save: only this revision completing while the document
    // is unchanged may clear dirty. Edits during flight keep dirty=true so
    // the newest state saves next (no stale save marks newer state clean).
    const revisionAtStart = useCanvasStore.getState().revision

    isSavingRef.current = true

    try {
      await autoSaveCanvas(designId, {
        nodes: stateAtStart.nodes,
        edges: stateAtStart.edges,
        version: versionAtStart,
        revision: revisionAtStart,
      })

      if (useCanvasStore.getState().revision === revisionAtStart) {
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
         * Base-version conflict. Only retry when the server version is our
         * own lineage (same-tab race, e.g. a manual save landed first) — then
         * retrying the LATEST state on the fresh base is safe. A foreign
         * version means another writer changed the design: retrying would
         * overwrite their work, so abort loud and stay dirty for an explicit
         * user save. Backend checks untouched.
         */
        let freshVersion = null
        try {
          const fresh = await api.getDesign(designId)
          freshVersion = fresh?.version ?? null
        } catch {
          // Version refresh failed — a later edit retries with the old base
          // (bounded) or manual save recovers.
        }
        if (freshVersion != null) {
          versionRef.current = Math.max(versionRef.current ?? freshVersion, freshVersion)
        }
        if (shouldRetryAfterConflict({
          origin: serverVersionOrigin(freshVersion),
          retries: retryCountRef.current,
          maxRetries: MAX_RETRIES,
        })) {
          retryCountRef.current += 1
          if (timeoutRef.current) clearTimeout(timeoutRef.current)
          timeoutRef.current = setTimeout(performSave, AUTOSAVE_DELAY)
          return
        }
        console.error(
          'Auto-save version conflict with another writer. Manual save to resolve — autosave will not overwrite their changes.',
          err,
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