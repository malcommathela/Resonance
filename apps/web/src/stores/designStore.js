import { create } from 'zustand'
import { api } from '@/services/api'

export const useDesignStore = create((set, get) => ({
  designs: [],
  currentDesign: null,
  isLoading: false,
  isSaving: false,
  saveStatus: 'idle', // 'idle' | 'saving' | 'saved' | 'error'
  error: null,
  lastDeleted: null, // For undo

  loadDesigns: async () => {
    set({ isLoading: true, error: null })
    try {
      const designs = await api.getDesigns()
      set({ designs, isLoading: false })
      return designs
    } catch (err) {
      set({ error: err.message, isLoading: false })
      throw err
    }
  },

  loadDesign: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const design = await api.getDesign(id)
      set({ currentDesign: design, isLoading: false })
      return design
    } catch (err) {
      set({ error: err.message, isLoading: false })
      throw err
    }
  },

  createDesign: async (design) => {
    set({ isLoading: true, error: null })
    try {
      const newDesign = await api.createDesign(design)
      set({ 
        designs: [newDesign, ...get().designs],
        currentDesign: newDesign,
        isLoading: false 
      })
      return newDesign
    } catch (err) {
      set({ error: err.message, isLoading: false })
      throw err
    }
  },

  updateDesign: async (id, updates) => {
    try {
      const updated = await api.updateDesign(id, updates)
      set({
        designs: get().designs.map(d => d.id === id ? { ...d, ...updated } : d),
        currentDesign: get().currentDesign?.id === id ? { ...get().currentDesign, ...updated } : get().currentDesign,
      })
      return updated
    } catch (err) {
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
      // Rollback on error
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
      })
      set({ designs: [duplicate, ...get().designs] })
      return duplicate
    } catch (err) {
      set({ error: err.message })
      throw err
    }
  },

  saveCanvas: async (id, { nodes, edges }) => {
    set({ isSaving: true, saveStatus: 'saving' })
    try {
      await api.saveCanvas(id, { nodes, edges })
      set({ 
        isSaving: false, 
        saveStatus: 'saved',
        currentDesign: get().currentDesign ? {
          ...get().currentDesign,
          updatedAt: new Date().toISOString()
        } : null
      })
      setTimeout(() => set({ saveStatus: 'idle' }), 2000)
    } catch (err) {
      set({ isSaving: false, saveStatus: 'error', error: err.message })
      throw err
    }
  },

  autoSaveCanvas: async (id, { nodes, edges }) => {
    try {
      await api.autoSaveCanvas(id, { nodes, edges })
      set({ 
        saveStatus: 'saved',
        currentDesign: get().currentDesign ? {
          ...get().currentDesign,
          updatedAt: new Date().toISOString()
        } : null
      })
      setTimeout(() => set({ saveStatus: 'idle' }), 2000)
    } catch (err) {
      set({ saveStatus: 'error' })
      console.error('Auto-save failed:', err)
    }
  },

  setCurrentDesign: (design) => set({ currentDesign: design }),
  clearError: () => set({ error: null }),
  clearLastDeleted: () => set({ lastDeleted: null }),
}))