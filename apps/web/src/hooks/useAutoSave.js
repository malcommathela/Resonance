import { useEffect, useRef, useCallback } from 'react'
import { useDesignStore } from '@/stores/designStore'

const AUTOSAVE_DELAY = 2000 // 2 seconds debounce
const MAX_RETRIES = 3

export const useAutoSave = (designId, nodes, edges, enabled = true) => {
  const { autoSaveCanvas, saveStatus } = useDesignStore()
  const timeoutRef = useRef(null)
  const lastSavedRef = useRef(null)
  const retryCountRef = useRef(0)
  const isSavingRef = useRef(false)

  // Serialize for comparison (stable JSON)
  const serialize = useCallback((n, e) => {
    return JSON.stringify({
      nodes: n.map(node => ({
        id: node.id,
        position: node.position,
        data: node.data,
        type: node.type,
      })),
      edges: e.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        data: edge.data,
        type: edge.type,
        animated: edge.animated,
      }))
    })
  }, [])

  const performSave = useCallback(async () => {
    if (!designId || designId === 'new' || isSavingRef.current) return

    isSavingRef.current = true
    try {
      await autoSaveCanvas(designId, { nodes, edges })
      lastSavedRef.current = serialize(nodes, edges)
      retryCountRef.current = 0
    } catch (err) {
      retryCountRef.current++
      if (retryCountRef.current < MAX_RETRIES) {
        // Retry after delay
        timeoutRef.current = setTimeout(performSave, AUTOSAVE_DELAY * retryCountRef.current)
      }
    } finally {
      isSavingRef.current = false
    }
  }, [designId, nodes, edges, autoSaveCanvas, serialize])

  useEffect(() => {
    if (!enabled || !designId || designId === 'new') return

    const current = serialize(nodes, edges)

    // Only save if content changed
    if (current !== lastSavedRef.current) {
      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Debounced save
      timeoutRef.current = setTimeout(performSave, AUTOSAVE_DELAY)
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [nodes, edges, designId, enabled, serialize, performSave])

  // Save on page unload
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (saveStatus === 'saving') {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [saveStatus])

  return { saveStatus }
}
