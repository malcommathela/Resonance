import { create } from 'zustand'
import { api } from '@/services/api'

// Helper to ensure designs always have computed fields
const enrichDesign = (design) => {
  if (!design) return null
  return {
    ...design,
    blocks: design.blocks ?? design.nodeCount ?? design.nodes?.length ?? 0,
    accentColor: design.accentColor || '#6366f1'
  }
}

export const useDesignStore = create((set, get) => ({
  designs: [],
  currentDesign: null,
  isLoading: false,
  isSaving: false,
  saveStatus: 'idle',
  error: null,
  lastDeleted: null,

  loadDesigns: async () => {
    set({ isLoading: true, error: null })
    try {
      const designs = await api.getDesigns()
      const enriched = designs.map(enrichDesign)
      set({ designs: enriched, isLoading: false })
      return enriched
    } catch (err) {
      set({ error: err.message, isLoading: false })
      throw err
    }
  },

  loadDesign: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const design = await api.getDesign(id)
      const enriched = enrichDesign(design)
      set({ currentDesign: enriched, isLoading: false })
      return enriched
    } catch (err) {
      set({ error: err.message, isLoading: false })
      throw err
    }
  },

  createDesign: async (design) => {
    set({ isLoading: true, error: null })
    try {
      const newDesign = await api.createDesign(design)
      const enriched = enrichDesign(newDesign)
      set({ 
        designs: [enriched, ...get().designs],
        currentDesign: enriched,
        isLoading: false 
      })
      return enriched
    } catch (err) {
      set({ error: err.message, isLoading: false })
      throw err
    }
  },

  // FIXED: Optimistic update that preserves accentColor even if API strips it
  updateDesign: async (id, updates) => {
    try {
      // Optimistically update local state immediately
      set(state => ({
        designs: state.designs.map(d => d.id === id ? { ...d, ...updates } : d),
        currentDesign: state.currentDesign?.id === id 
          ? { ...state.currentDesign, ...updates } 
          : state.currentDesign,
      }))

      // Send to API
      const updated = await api.updateDesign(id, updates)
      
      // Merge API response with our updates (API might strip unknown fields like accentColor)
      const merged = enrichDesign({ ...updated, ...updates })
      
      set(state => ({
        designs: state.designs.map(d => d.id === id ? { ...d, ...merged } : d),
        currentDesign: state.currentDesign?.id === id 
          ? { ...state.currentDesign, ...merged } 
          : state.currentDesign,
      }))
      
      return merged
    } catch (err) {
      // Revert on error by reloading
      await get().loadDesigns()
      set({ error: err.message })
      throw err
    }
  },

  deleteDesign: async (id) => {
    const design = get().designs.find(d => d.id === id)
    set({
      designs: get().designs.filter(d => d.id !== id),
      currentDesign: get().currentDesign?.id === id ? null : get().currentDesign,
      lastDeleted: design,
    })
    try {
      await api.deleteDesign(id)
      return true
    } catch (err) {
      set({
        designs: [design, ...get().designs],
        lastDeleted: null,
        error: `Failed to delete: ${err.message}`,
      })
      throw err
    }
  },

  restoreDesign: async () => {
    const { lastDeleted } = get()
    if (!lastDeleted) return
    set({ lastDeleted: null, designs: [lastDeleted, ...get().designs] })
  },

  duplicateDesign: async (id) => {
    const original = get().designs.find(d => d.id === id)
    if (!original) throw new Error('Design not found')
    
    try {
      const duplicate = await api.createDesign({
        name: `${original.name} (Copy)`,
        description: original.description,
        repoUrl: original.repoUrl,
        repoBranch: original.repoBranch,
        accentColor: original.accentColor,
      })
      const enriched = enrichDesign(duplicate)
      set({ designs: [enriched, ...get().designs] })
      return enriched
    } catch (err) {
      set({ error: err.message })
      throw err
    }
  },

  saveCanvas: async (id, { nodes, edges }) => {
    set({ isSaving: true, saveStatus: 'saving' })
    try {
      await api.saveCanvas(id, { nodes, edges })
      
      const blockCount = nodes?.length || 0
      
      set(state => ({
        isSaving: false, 
        saveStatus: 'saved',
        designs: state.designs.map(d => d.id === id ? { ...d, blocks: blockCount, updatedAt: new Date().toISOString() } : d),
        currentDesign: state.currentDesign?.id === id ? {
          ...state.currentDesign,
          blocks: blockCount,
          updatedAt: new Date().toISOString()
        } : state.currentDesign
      }))
      
      setTimeout(() => set({ saveStatus: 'idle' }), 2000)
    } catch (err) {
      set({ isSaving: false, saveStatus: 'error', error: err.message })
      throw err
    }
  },

  autoSaveCanvas: async (id, { nodes, edges }) => {
    try {
      await api.autoSaveCanvas(id, { nodes, edges })
      
      const blockCount = nodes?.length || 0
      
      set(state => ({
        saveStatus: 'saved',
        designs: state.designs.map(d => d.id === id ? { ...d, blocks: blockCount, updatedAt: new Date().toISOString() } : d),
        currentDesign: state.currentDesign?.id === id ? {
          ...state.currentDesign,
          blocks: blockCount,
          updatedAt: new Date().toISOString()
        } : state.currentDesign
      }))
      
      setTimeout(() => set({ saveStatus: 'idle' }), 2000)
    } catch (err) {
      set({ saveStatus: 'error' })
      console.error('Auto-save failed:', err)
    }
  },

  setCurrentDesign: (design) => set({ currentDesign: enrichDesign(design) }),
  clearError: () => set({ error: null }),
  clearLastDeleted: () => set({ lastDeleted: null }),
}))