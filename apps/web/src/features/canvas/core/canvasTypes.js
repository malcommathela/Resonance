import { ArchitectureNode } from '../nodes/ArchitectureNode'
import { ArchitectureEdge } from '../edges/ArchitectureEdge'
import { CanvasGroup } from '../groups/CanvasGroup'
import { CanvasNote } from '../notes/CanvasNote'

// Stable React Flow type maps (module-level: never recreated per render).
// Both map the persisted legacy type keys, so existing designs render
// unchanged in data — only the presentation is V2.
export const nodeTypes = { customBlock: ArchitectureNode, group: CanvasGroup, note: CanvasNote }
export const edgeTypes = { customEdge: ArchitectureEdge }
