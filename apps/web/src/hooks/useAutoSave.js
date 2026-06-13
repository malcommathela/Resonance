import { useEffect, useRef, useCallback } from 'react'
import { useDesignStore } from '@/stores/designStore'

const AUTOSAVE_DELAY = 10000
const MAX_RETRIES = 3

export const useAutoSave = (designId, nodes, edges, enabled = true) => {
  const { autoSaveCanvas, saveStatus } = useDesignStore()
  const timeoutRef = useRef(null)
  const lastSavedRef = useRef(null)
  const retryCountRef = useRef(0)
  const isSavingRef = useRef(false)
  const skipNextSaveRef = useRef(false)

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
        timeoutRef.current = setTimeout(performSave, AUTOSAVE_DELAY * retryCountRef.current)
      }
    } finally {
      isSavingRef.current = false
    }
  }, [designId, nodes, edges, autoSaveCanvas, serialize])

  useEffect(() => {
    if (!enabled || !designId || designId === 'new') return
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false
      return
    }
    const current = serialize(nodes, edges)
    if (current !== lastSavedRef.current) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(performSave, AUTOSAVE_DELAY)
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [nodes, edges, designId, enabled, serialize, performSave])

  const skipNextAutoSave = useCallback(() => {
    skipNextSaveRef.current = true
  }, [])

  return { saveStatus, skipNextAutoSave }
}
