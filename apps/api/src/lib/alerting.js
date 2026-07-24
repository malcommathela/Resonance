import { logger } from './logger.js'

const WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL
const ALERT_COOLDOWN_MS = parseInt(process.env.ALERT_COOLDOWN_MS || '60000', 10)
const ALERT_THRESHOLD = parseInt(process.env.ALERT_THRESHOLD || '5', 10)

let lastAlertTime = 0
let errorCount = 0
let resetTimer = null

function resetCounter() {
  errorCount = 0
  resetTimer = null
}

/**
 * L12: Send alert to Slack/Discord webhook.
 * Critical alerts always fire. Error alerts debounce by threshold + cooldown.
 */
export async function sendAlert({ level = 'error', message, context = {} }) {
  if (!WEBHOOK_URL) {
    logger.debug('No ALERT_WEBHOOK_URL configured; skipping alert')
    return
  }

  const now = Date.now()

  if (level === 'critical') {
    if (now - lastAlertTime < ALERT_COOLDOWN_MS) return
  } else if (level === 'error') {
    errorCount++
    if (!resetTimer) resetTimer = setTimeout(resetCounter, 60000)
    if (errorCount < ALERT_THRESHOLD) return
    if (now - lastAlertTime < ALERT_COOLDOWN_MS) return
  } else {
    return
  }

  lastAlertTime = now

  // Auto-detect Discord vs Slack by URL pattern
  const isDiscord = WEBHOOK_URL.includes('discordapp.com') || WEBHOOK_URL.includes('discord.com')

  const fields = Object.entries(context).map(([name, value]) => ({
    name,
    value: String(value).substring(0, 1000),
    inline: false,
  }))

  let payload

  if (isDiscord) {
    payload = {
      embeds: [{
        title: level === 'critical' ? '🚨 CRITICAL — Resonance API' : '⚠️ ERROR SPIKE — Resonance API',
        description: message,
        color: level === 'critical' ? 0xFF0000 : 0xFFA500,
        fields,
        footer: { text: `PID ${process.pid} • ${process.env.NODE_ENV || 'unknown'}` },
        timestamp: new Date(now).toISOString(),
      }],
    }
  } else {
    // Slack legacy format
    payload = {
      text: level === 'critical' ? '🚨 *CRITICAL* — Resonance API' : '⚠️ *ERROR SPIKE* — Resonance API',
      attachments: [{
        color: level === 'critical' ? 'danger' : 'warning',
        text: message,
        fields: fields.map(f => ({ title: f.name, value: f.value, short: false })),
        footer: `PID ${process.pid} • ${process.env.NODE_ENV || 'unknown'}`,
        ts: Math.floor(now / 1000),
      }],
    }
  }

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    logger.info({ webhookStatus: res.status, level }, 'Alert sent')
  } catch (err) {
    logger.error({ err: err.message }, 'Failed to send alert')
  }
}

/**
 * Track 5xx errors in a rolling 60s window. Triggers alert when threshold breached.
 */
export function trackErrorForAlert(err) {
  errorCount++
  if (!resetTimer) {
    resetTimer = setTimeout(resetCounter, 60000)
  }
  if (errorCount >= ALERT_THRESHOLD) {
    sendAlert({
      level: 'error',
      message: `Error threshold exceeded (${errorCount} errors in 60s)`,
      context: { latestError: err.message },
    })
  }
}