// Canonical canvas selectors (Phase 1). Derive only — no new state.
// Splits the store into V2 boundaries: document / UI / validation /
// simulation / persistence, so components subscribe narrowly.
export const selectDocument = (s) => ({ nodes: s.nodes, edges: s.edges })

export const selectUi = (s) => ({
  selection: { nodeIds: s.selectedNodeIds, edgeIds: s.selectedEdgeIds },
  primaryNodeId: s.selectedNodeId ?? s.selectedNodeIds[0] ?? null,
  primaryEdgeId: s.selectedEdgeId ?? s.selectedEdgeIds[0] ?? null,
  validationHighlight: s.validationHighlight,
  panels: s.panels,
  activeTab: s.activeTab,
  zoom: s.zoom,
})

export const selectValidation = (s) => ({
  result: s.validationResult,
  loading: s.isValidating,
})

export const selectSimulation = (s) => ({
  running: s.simulationRunning,
  status: s.simulationStatus,
  progress: s.simulationProgress,
  metrics: s.simulationMetrics,
  blockMetrics: s.simulationBlockMetrics,
  edgeMetrics: s.simulationEdgeMetrics,
  alerts: s.simulationAlerts,
  reportId: s.simulationReportId,
  autoOpenReport: s.simulationAutoOpenReport,
  error: s.simulationErrorMessage,
})

export const selectPersistence = (s) => ({ dirty: s.isDirty })
