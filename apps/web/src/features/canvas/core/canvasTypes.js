import { ArchitectureNode } from '../nodes/ArchitectureNode'
import { ArchitectureEdge } from '../edges/ArchitectureEdge'
import { CanvasGroup } from '../groups/CanvasGroup'

// Stable React Flow type maps (module-level: never recreated per render).
// Legacy `note` nodes are filtered on load (see canvasStore.loadDesign), so
// no note entry is registered — unknown types never render.
//
// Semantic predicates (Phase 3): use these, never raw `node.type === ...`
// scattered through validation/persistence/simulation/grouping/selection.
export const isArchitectureNode = (n) => n?.type === 'customBlock'
export const isGroupNode = (n) => n?.type === 'group'
// Canvas-only objects never enter simulation/validation-block/persisted-block payloads.
export const isCanvasOnlyNode = (n) => isGroupNode(n) || n?.type === 'note'
// Architecture nodes are the only simulation inputs.
export const isSimulatableNode = (n) => isArchitectureNode(n)
export const nodeTypes = { customBlock: ArchitectureNode, group: CanvasGroup }
export const edgeTypes = { customEdge: ArchitectureEdge }
