import { create } from 'zustand'
import { api } from '@/services/api'
import {
  fetchDesignReports,
  fetchSimulationReport,
  compareReports as compareSimulationReports,
  cacheReport,
} from '@/services/simulation'

// Helper to ensure designs always have computed fields
const enrichDesign = (design) => {
  if (!design) return null
  return {
    ...design,
    // API now returns real blocks count; keep fallback only for legacy shapes
    blocks: design.blocks ?? design.nodeCount ?? design.nodes?.length ?? 0,
    accentColor: design.accentColor || '#6366f1',
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

  // === BATCH 5E: REPORT STATE ===
  reports: [],
  reportsLoading: false,
  reportsError: null,
  selectedReportId: null,
  currentReport: null,
  // === END BATCH 5E ===

  // === OVERVIEW & AUDIT STATE ===
  overview: null,
  overviewLoading: false,
  auditLogs: [],
  auditLogsLoading: false,
  // === END OVERVIEW & AUDIT ===

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
        isLoading: false,
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
      set((state) => ({
        designs: state.designs.map((d) => (d.id === id ? { ...d, ...updates } : d)),
        currentDesign:
          state.currentDesign?.id === id
            ? { ...state.currentDesign, ...updates }
            : state.currentDesign,
      }))

      // Send to API
      const updated = await api.updateDesign(id, updates)

      // Merge API response with our updates (API might strip unknown fields like accentColor)
      const merged = enrichDesign({ ...updated, ...updates })

      set((state) => ({
        designs: state.designs.map((d) => (d.id === id ? { ...d, ...merged } : d)),
        currentDesign:
          state.currentDesign?.id === id
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
    const design = get().designs.find((d) => d.id === id)
    set({
      designs: get().designs.filter((d) => d.id !== id),
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
    const original = get().designs.find((d) => d.id === id)
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

      set((state) => ({
        isSaving: false,
        saveStatus: 'saved',
        designs: state.designs.map((d) =>
          d.id === id
            ? { ...d, blocks: blockCount, updatedAt: new Date().toISOString() }
            : d
        ),
        currentDesign:
          state.currentDesign?.id === id
            ? {
                ...state.currentDesign,
                blocks: blockCount,
                updatedAt: new Date().toISOString(),
              }
            : state.currentDesign,
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

      set((state) => ({
        saveStatus: 'saved',
        designs: state.designs.map((d) =>
          d.id === id
            ? { ...d, blocks: blockCount, updatedAt: new Date().toISOString() }
            : d
        ),
        currentDesign:
          state.currentDesign?.id === id
            ? {
                ...state.currentDesign,
                blocks: blockCount,
                updatedAt: new Date().toISOString(),
              }
            : state.currentDesign,
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

  // === BATCH 5E: REPORT ACTIONS ===
  loadReports: async (designId) => {
    if (!designId) return []
    set({ reportsLoading: true, reportsError: null })
    try {
      const reports = await fetchDesignReports(designId)
      set({ reports: reports || [], reportsLoading: false })
      return reports || []
    } catch (err) {
      set({ reportsError: err.message, reportsLoading: false })
      return []
    }
  },

  selectReport: (reportId) => set({ selectedReportId: reportId }),

  loadReport: async (simulationId) => {
    if (!simulationId) return null
    try {
      const report = await fetchSimulationReport(simulationId)
      if (report) {
        cacheReport(report.id || simulationId, report)
        set({ currentReport: report })
      }
      return report
    } catch (err) {
      console.error('Failed to load simulation report:', err)
      set({ reportsError: err.message })
      return null
    }
  },

  compareReports: (idA, idB) => {
    const { reports } = get()
    const reportA = reports.find((r) => r.id === idA || r.simulationId === idA)
    const reportB = reports.find((r) => r.id === idB || r.simulationId === idB)
    if (!reportA || !reportB) return null
    return compareSimulationReports(reportA, reportB)
  },

  clearReports: () =>
    set({
      reports: [],
      reportsError: null,
      selectedReportId: null,
      currentReport: null,
    }),
  // === END BATCH 5E ===

  // === OVERVIEW & AUDIT ACTIONS ===
  loadOverview: async (designId) => {
    if (!designId) return null
    set({ overviewLoading: true, error: null })
    try {
      const overview = await api.getDesignOverview(designId)
      set({ overview, overviewLoading: false })
      return overview
    } catch (err) {
      set({ overviewLoading: false, error: err.message })
      return null
    }
  },

  loadAuditLogs: async (designId) => {
    if (!designId) return []
    set({ auditLogsLoading: true, error: null })
    try {
      const logs = await api.getDesignAuditLogs(designId)
      set({ auditLogs: logs, auditLogsLoading: false })
      return logs
    } catch (err) {
      set({ auditLogsLoading: false, error: err.message })
      return []
    }
  },
  // === END OVERVIEW & AUDIT ===

  // === TEAM DESIGN ACTIONS ===
  loadTeamDesigns: async (teamId) => {
    if (!teamId) return []
    set({ isLoading: true, error: null })
    try {
      const designs = await api.getTeamDesigns(teamId)
      const enriched = designs.map(enrichDesign)
      return enriched
    } catch (err) {
      set({ error: err.message, isLoading: false })
      throw err
    }
  },

  createTeamDesign: async (teamId, design) => {
    set({ isLoading: true, error: null })
    try {
      const newDesign = await api.createTeamDesign(teamId, design)
      const enriched = enrichDesign(newDesign)
      set({
        designs: [enriched, ...get().designs],
        currentDesign: enriched,
        isLoading: false,
      })
      return enriched
    } catch (err) {
      set({ error: err.message, isLoading: false })
      throw err
    }
  },

  importDesignToTeam: async (teamId, designId) => {
    set({ isLoading: true, error: null })
    try {
      const updated = await api.importDesignToTeam(teamId, designId)
      const enriched = enrichDesign(updated)
      set({
        designs: get().designs.map((d) => (d.id === designId ? enriched : d)),
        currentDesign:
          get().currentDesign?.id === designId
            ? enriched
            : get().currentDesign,
        isLoading: false,
      })
      return enriched
    } catch (err) {
      set({ error: err.message, isLoading: false })
      throw err
    }
  },

  removeDesignFromTeam: async (teamId, designId) => {
    set({ isLoading: true, error: null })
    try {
      const updated = await api.removeDesignFromTeam(teamId, designId)
      const enriched = enrichDesign(updated)
      set({
        designs: get().designs.map((d) => (d.id === designId ? enriched : d)),
        currentDesign:
          get().currentDesign?.id === designId
            ? enriched
            : get().currentDesign,
        isLoading: false,
      })
      return enriched
    } catch (err) {
      set({ error: err.message, isLoading: false })
      throw err
    }
  },
  // === END TEAM DESIGN ACTIONS ===
}))