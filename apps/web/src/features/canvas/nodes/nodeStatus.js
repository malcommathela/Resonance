// Pure status mapping for ArchitectureNode (dependency-free).
// Priority: validation finding > simulation fault > saturation > running > idle.
// Covered by nodeStatus.check.js (run: node nodeStatus.check.js).
export const TONE_COLOR = {
  critical: 'rgb(var(--error-rgb))',
  warning: 'rgb(var(--warning-rgb))',
  risk: 'rgb(var(--warning-rgb))',
  info: 'rgb(var(--text-muted-rgb))',
  error: 'rgb(var(--error-rgb))',
  ok: 'rgb(var(--success-rgb))',
}

export function nodeStatus({ highlighted, severity, running, runtime } = {}) {
  if (highlighted) return { tone: severity || 'warning', active: false }
  if (running && runtime) {
    if (runtime.circuitOpen) return { tone: 'error', active: true }
    if ((runtime.utilization || 0) > 0.95) return { tone: 'warning', active: true }
    return { tone: 'ok', active: true }
  }
  return { tone: 'idle', active: false }
}
