/*
 * Report export — serialize the already-loaded, normalized report object
 * (see services/simulation.js) to JSON / Markdown and download via Blob.
 * No API calls, no new schema, no dependencies.
 */

export function formatReportAsJson(report) {
  return JSON.stringify(report ?? {}, null, 2)
}

const maybeParse = (val) => {
  if (typeof val !== 'string') return val
  try {
    return JSON.parse(val)
  } catch {
    return val
  }
}

function formatValue(value, depth = 0) {
  const v = maybeParse(value)
  if (v == null) return 'N/A'
  if (typeof v === 'string') return v.trim() === '' ? 'N/A' : v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) {
    if (!v.length) return 'None.'
    return v
      .map((item) => {
        if (item != null && typeof item === 'object') {
          const title = item.title || item.label || item.name || item.message || null
          const rest = { ...item }
          if (title) {
            delete rest.title
            delete rest.label
            const detail = Object.keys(rest).length ? ` — ${formatInline(rest, depth + 1)}` : ''
            return `- **${title}**${detail}`
          }
          return `- ${formatInline(item, depth + 1)}`
        }
        return `- ${formatValue(item, depth + 1)}`
      })
      .join('\n')
  }
  if (typeof v === 'object') {
    const entries = Object.entries(v)
    if (!entries.length) return 'None.'
    if (depth > 0) return `\`${JSON.stringify(v)}\``
    return entries.map(([k, val]) => `**${k}:** ${formatInline(val, depth + 1)}`).join('\n\n')
  }
  return String(v)
}

function formatInline(value, depth = 0) {
  const v = maybeParse(value)
  if (v == null) return 'N/A'
  if (typeof v === 'string') return v.trim() === '' ? 'N/A' : v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (depth > 2) return `\`${JSON.stringify(v)}\``
  if (Array.isArray(v)) return v.map((i) => formatInline(i, depth + 1)).join('; ')
  if (typeof v === 'object') {
    return Object.entries(v)
      .map(([k, val]) => `${k}: ${formatInline(val, depth + 1)}`)
      .join('; ')
  }
  return String(v)
}

const scoreRow = (label, value) => `| ${label} | ${Number.isFinite(value) ? value : 'N/A'} |`

export function formatReportAsMarkdown(report = {}) {
  const r = report ?? {}
  const sim = maybeParse(r.simulation) ?? {}
  const meta = maybeParse(r.metadata) ?? {}
  const lines = []

  lines.push('# Resonance Simulation Report', '')
  lines.push('## Report Information', '')
  lines.push(`- Report ID: ${r.id ?? 'N/A'}`)
  lines.push(`- Simulation ID: ${r.simulationId ?? sim.id ?? 'N/A'}`)
  lines.push(`- Design ID: ${r.designId ?? r.design?.id ?? 'N/A'}`)
  lines.push(`- Version: ${r.version ?? 'N/A'}`)
  lines.push(`- Generated: ${r.generatedAt ?? r.createdAt ?? 'N/A'}`, '')

  lines.push('## Simulation Information', '')
  lines.push(`- Scenario: ${sim.scenario ?? r.scenario ?? 'N/A'}`)
  lines.push(`- Duration: ${sim.duration ?? r.duration ?? 'N/A'}`)
  lines.push(`- Monte Carlo passes: ${sim.monteCarloPasses ?? meta.monteCarloPasses ?? 'N/A'}`)
  lines.push(`- Status: ${sim.status ?? r.status ?? 'N/A'}`)
  lines.push(`- Created: ${sim.createdAt ?? r.createdAt ?? 'N/A'}`, '')

  lines.push('## Overall Assessment', '')
  lines.push(formatValue(r.summary ?? r.executiveSummary, 0), '')

  lines.push('## Scores', '', '| Category | Score |', '|---|---:|')
  lines.push(scoreRow('Overall', r.overallScore ?? r.score))
  lines.push(scoreRow('Architecture', r.architectureScore))
  lines.push(scoreRow('Reliability', r.reliabilityScore))
  lines.push(scoreRow('Performance', r.performanceScore))
  lines.push(scoreRow('Scalability', r.scalabilityScore))
  lines.push(scoreRow('Cost', r.costScore))
  lines.push(scoreRow('Security', r.securityScore))
  lines.push(scoreRow('Confidence', r.confidenceScore))
  lines.push('')

  for (const [heading, key] of [
    ['Executive Summary', 'executiveSummary'],
    ['Topology Analysis', 'topologyAnalysis'],
    ['Performance Analysis', 'performanceAnalysis'],
    ['Reliability Analysis', 'reliabilityAnalysis'],
    ['Scalability Analysis', 'scalabilityAnalysis'],
    ['Cost Analysis', 'costAnalysis'],
    ['Security Analysis', 'securityAnalysis'],
  ]) {
    lines.push(`## ${heading}`, '', formatValue(r[key], 0), '')
  }

  lines.push('## Failure Scenarios', '')
  const scenarios = maybeParse(r.failureScenarios)
  if (Array.isArray(scenarios) && scenarios.length) {
    scenarios.forEach((s, i) => {
      if (s != null && typeof s === 'object') {
        lines.push(`### ${i + 1}. ${s.title || s.name || 'Scenario'}`, '', formatValue(s, 1), '')
      } else {
        lines.push(`### ${i + 1}. Scenario`, '', formatValue(s, 1), '')
      }
    })
  } else {
    lines.push(formatValue(scenarios, 0), '')
  }

  lines.push('## AI Insights', '', formatValue(r.aiInsights, 0), '')

  lines.push('## Recommended Actions', '')
  const plan = maybeParse(r.actionPlan)
  if (plan != null && typeof plan === 'object' && !Array.isArray(plan) && ['critical', 'high', 'medium', 'low'].some((k) => plan[k] != null)) {
    for (const level of ['critical', 'high', 'medium', 'low']) {
      if (plan[level] == null) continue
      lines.push(`### ${level[0].toUpperCase() + level.slice(1)}`, '', formatValue(plan[level], 0), '')
    }
  } else {
    lines.push(formatValue(plan, 0), '')
  }

  lines.push('## Assumptions', '', formatValue(meta.assumptions ?? r.assumptions, 0), '')
  lines.push('## Simulation Metadata', '', formatValue({
    engineVersion: meta.engineVersion ?? sim.engineVersion,
    reportVersion: meta.reportVersion ?? r.version,
    monteCarloPasses: meta.monteCarloPasses ?? sim.monteCarloPasses,
    deterministicSeed: meta.deterministicSeed ?? sim.deterministicSeed,
    simulationDuration: meta.simulationDuration ?? sim.duration,
    confidenceScore: r.confidenceScore,
  }, 0), '')

  return lines.join('\n')
}

export function buildReportFilename(report = {}, ext = 'json') {
  const raw = report?.simulationId || report?.simulation?.id || report?.id || ''
  const clean = String(raw).replace(/[/\\:*?"<>|]/g, '').trim().slice(0, 64)
  return clean ? `resonance-report-${clean}.${ext}` : `resonance-report.${ext}`
}

export function downloadReport(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
