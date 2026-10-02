// Simulation input boundary (Phase 9). The engine is untouched — this only
// decides what crosses into it: architecture blocks and edges, never groups,
// notes, canvas-only objects, or per-tick runtime state.
// Dependency-free: covered by simulationInput.check.js.
import { toSimulationInput } from '../core/document.js'

// Accepts a canonical document or { nodes, edges }. Returns the exact
// { nodes, edges } shape the simulation pipeline consumes.
export function createSimulationInput(doc) {
  return toSimulationInput(doc || { nodes: [], edges: [] })
}
