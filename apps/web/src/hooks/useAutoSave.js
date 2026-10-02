import { useEffect, useRef, useCallback, useState } from 'react'
import { useDesignStore, serverVersionOrigin } from '@/stores/designStore'
import { useCanvasStore } from '@/stores/canvasStore'
import {
  shouldRetryAfterConflict,
  freezeSaveSnapshot,
  isSessionCurrent,
} from '@/features/canvas/persistence/canvasPersistence'
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

  // Session identity for THIS hook instance. The component survives A→B
  // navigation (no route key), so designId alone can't invalidate A's work.
  const sessionRef = useRef({ designId, generation: 0 })

  const retryCountRef = useRef(0)
  const isSavingRef = useRef(false)
  const dirtyRef = useRef(false)

  // Foreign-writer conflict surfaced to the UI (banner offers reload theirs /
  // save mine anyway). Set on 409-abort, cleared on success or hydration.
  const [conflict, setConflict] = useState(null)
  const dismissConflict = useCallback(() => setConflict(null), [])
  const reportConflict = useCallback((entry) => setConflict(entry), [])

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
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

    // Monotonic: the 409 path may have refreshed to a NEWER base version than
    // the prop (currentDesign only advances on successful save). Never slide
    // back — markHydrated is the explicit reset point on design load.
    if (version != null) {
      versionRef.current = Math.max(versionRef.current ?? version, version)
    }
  }, [nodes, edges, version])

  /*
   * Hydration establishes the baseline AND invalidates the previous session.
   *
   * Must be called immediately after a design loads. Bumps the generation so
   * pending timers and in-flight requests from the old session no-op, and
   * clears timers that might otherwise fire with a stale closure.
   */
  const markHydrated = useCallback((hydratedDesignId, hydratedNodes, hydratedEdges, hydratedVersion) => {
    sessionRef.current = {
      designId: hydratedDesignId,
      generation: sessionRef.current.generation + 1,
    }
    clearTimers()

    latestStateRef.current = {
      nodes: hydratedNodes || [],
      edges: hydratedEdges || [],
    }

    versionRef.current = hydratedVersion ?? null
    dirtyRef.current = false
    retryCountRef.current = 0
    isSavingRef.current = false
    setConflict(null)
  }, [clearTimers])

  const getSession = useCallback(() => ({ ...sessionRef.current }), [])

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
    // Session gate: a timer scheduled under a previous session must never
    // issue a request for another design, even if dirty was set meanwhile.
    if (sessionRef.current.designId !== designId) {
      return
    }
    if (
      !enabled ||
      !designId ||
      designId === 'new' ||
      !dirtyRef.current ||
      isSavingRef.current
    ) {
      return
    }

    const sessionAtStart = { ...sessionRef.current }
    const isCurrentSession = () => isSessionCurrent(sessionRef.current, sessionAtStart)

    // Immutable attempt snapshot: later edits, hydration, or session switches
    // cannot mutate what this request sends or acknowledges.
    const snapshot = freezeSaveSnapshot({
      designId,
      nodes: latestStateRef.current.nodes,
      edges: latestStateRef.current.edges,
      revision: useCanvasStore.getState().revision,
    })

    isSavingRef.current = true

    try {
      await autoSaveCanvas(snapshot.designId, {
        nodes: snapshot.nodes,
        edges: snapshot.edges,
        revision: snapshot.revision,
        // Version read at queue-EXECUTION time, not enqueue time, so a save
        // queued behind another sees the version the first one established.
        getVersion: () => versionRef.current,
      })

      // Stale session: touch nothing — not dirty, version, status, timestamps.
      if (!isCurrentSession()) return

      if (useCanvasStore.getState().revision === snapshot.revision) {
        dirtyRef.current = false
        setConflict(null)

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

        clearTimers()
        timeoutRef.current = setTimeout(
          () => { if (isCurrentSession()) performSave() },
          AUTOSAVE_DELAY
        )
      }
    } catch (err) {
      // Stale session: a failure from the old session must not poison the new
      // session's dirty/retry state.
      if (!isCurrentSession()) return

      /*
       * Never convert a failed save into a successful state.
       */
      dirtyRef.current = true

      if (err?.status === 409) {
        /*
         * Base-version conflict. Prefer the version the server already sent
         * in the 409 body (no second race from re-fetching). Retry only our
         * own lineage; a foreign version means another writer changed the
         * design — abort loud and stay dirty for an explicit user save.
         * Backend checks untouched.
         */
        const freshVersion = err?.data?.currentVersion ?? (await api.getDesign(designId).catch(() => null))?.version ?? null
        if (freshVersion != null) {
          versionRef.current = Math.max(versionRef.current ?? freshVersion, freshVersion)
        }
        if (shouldRetryAfterConflict({
          origin: serverVersionOrigin(freshVersion),
          retries: retryCountRef.current,
          maxRetries: MAX_RETRIES,
        })) {
          retryCountRef.current += 1
          clearTimers()
          timeoutRef.current = setTimeout(
            () => { if (isCurrentSession()) performSave() },
            AUTOSAVE_DELAY
          )
          return
        }
        console.error(
          'Auto-save version conflict with another writer. Manual save to resolve — autosave will not overwrite their changes.',
          err,
        )
        // Surface to the banner (reload theirs / save mine anyway / dismiss).
        // Stays dirty throughout; next edits do NOT auto-retry a foreign
        // conflict (only the banner's explicit actions resolve it).
        setConflict({ designId, serverVersion: freshVersion })
        return
      }

      retryCountRef.current += 1

      if (retryCountRef.current < MAX_RETRIES) {
        const retryDelay = AUTOSAVE_DELAY * retryCountRef.current

        clearTimers()
        retryTimeoutRef.current = setTimeout(() => {
          if (isCurrentSession()) performSave()
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
    clearTimers,
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

    const sessionAtSchedule = { ...sessionRef.current }
    timeoutRef.current = setTimeout(
      () => { if (isSessionCurrent(sessionRef.current, sessionAtSchedule)) performSave() },
      AUTOSAVE_DELAY
    )

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
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
    getSession,
    conflict,
    reportConflict,
    dismissConflict,
    isDirty: dirtyRef.current,
  }
}
