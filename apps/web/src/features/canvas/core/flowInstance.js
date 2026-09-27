// Shared handle to the React Flow instance (Phase 7).
// Lets canvasCommands drive viewport ops (fit/focus) so mouse, keyboard and
// menus share one implementation. Registered by CanvasEditor; null outside it.
let instance = null

export const setFlowInstance = (next) => { instance = next }

export const getFlowInstance = () => instance
