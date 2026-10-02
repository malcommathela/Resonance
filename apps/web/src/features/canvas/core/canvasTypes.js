import { ArchitectureNode } from '../nodes/ArchitectureNode'
import { ArchitectureEdge } from '../edges/ArchitectureEdge'
import { CanvasGroup } from '../groups/CanvasGroup'

// Stable React Flow type maps (module-level: never recreated per render).
// Legacy `note` nodes are filtered on load (see canvasStore.loadDesign), so
// no note entry is registered — unknown types never render.
export const nodeTypes = { customBlock: ArchitectureNode, group: CanvasGroup }
export const edgeTypes = { customEdge: ArchitectureEdge }
