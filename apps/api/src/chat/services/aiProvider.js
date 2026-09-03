// ============================================================================
// AI PROVIDER — Chat spec §102
// Gemini client wrapper: singleton client, explicit timeouts, classified
// retries with backoff+jitter, circuit breaker, usage tracking, streaming.
// The provider is never treated as infinitely reliable.
// ============================================================================

import { GoogleGenAI } from '@google/genai'
import { logger } from '../../lib/logger.js'
import { AppError, ERROR_CODES } from '../../utils/errors.js'
import { withRetry } from '../../utils/retry.js'
import { withCircuitBreaker } from '../../utils/circuitBreaker.js'

// Singleton client (spec §99).
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

// Timeout budget (spec §53) — tunable via env for load testing.
const CONFIG = Object.freeze({
  chatModel: process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash',
  generationModel: process.env.GEMINI_GENERATION_MODEL || 'gemini-2.5-flash',
  chatMaxOutputTokens: parseInt(process.env.CHAT_MAX_OUTPUT_TOKENS || '4096', 10),
  generationMaxOutputTokens: parseInt(process.env.GENERATION_MAX_OUTPUT_TOKENS || '8192', 10),
  chatTimeoutMs: parseInt(process.env.CHAT_AI_TIMEOUT_MS || '45000', 10),
  generationTimeoutMs: parseInt(process.env.GENERATION_AI_TIMEOUT_MS || '120000', 10),
  chatRetries: parseInt(process.env.CHAT_AI_RETRIES || '2', 10),
  temperature: 0.4,
  generationTemperature: 0.2,
})

export const MODEL_INFO = Object.freeze({
  model: CONFIG.chatModel,
  modelVersion: '1',
})

function toGeminiHistory(history = []) {
  return history
    .filter((m) => m && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))
}

function normalizeProviderError(err) {
  if (err instanceof AppError) return err
  const msg = String(err?.message || err)
  let code = ERROR_CODES.AI_UNAVAILABLE
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(msg)) code = ERROR_CODES.AI_RATE_LIMIT
  else if (/400|INVALID_ARGUMENT|SAFETY|RECITATION|PERMISSION_DENIED|API key/i.test(msg)) code = ERROR_CODES.AI_INVALID_REQUEST
  else if (/timeout|ETIMEDOUT|aborted/i.test(msg)) code = ERROR_CODES.AI_TIMEOUT
  return new AppError(code, 'Resonance AI could not complete the request.', { cause: err })
}

// ────────────────────────────────────────────────────────────────────────────
// STREAMING CHAT
// ────────────────────────────────────────────────────────────────────────────

/**
 * Stream a chat completion.
 *
 * @param {object} params
 * @param {string} params.systemInstruction
 * @param {Array<{role:string, content:string}>} params.history — bounded recent turns
 * @param {string} params.userMessage
 * @param {number} [params.maxOutputTokens]
 * @param {number} [params.timeoutMs]
 * @param {Function} [params.onUsage] — ({ promptTokens, completionTokens }) => void
 * @returns {AsyncGenerator<string>} — text chunks
 */
export async function* streamChat({ systemInstruction, history, userMessage, maxOutputTokens, timeoutMs, onUsage }) {
  const deadline = Date.now() + (timeoutMs ?? CONFIG.chatTimeoutMs)

  const attempt = () =>
    withCircuitBreaker('gemini', async () => {
      const stream = await genAI.models.generateContentStream({
        model: CONFIG.chatModel,
        contents: [...toGeminiHistory(history), { role: 'user', parts: [{ text: userMessage }] }],
        config: {
          systemInstruction,
          temperature: CONFIG.temperature,
          maxOutputTokens: maxOutputTokens ?? CONFIG.chatMaxOutputTokens,
        },
      })
      return stream
    })

  let stream
  try {
    // Connection + first-token failures are retried; once streaming has begun
    // (generator body runs) errors propagate to the orchestrator as failed.
    stream = await withRetry(attempt, {
      retries: CONFIG.chatRetries,
      onRetry: (err, attemptNo, delay) =>
        logger.warn({ err: err.message, attempt: attemptNo, delay }, 'Gemini stream retry'),
    })
  } catch (err) {
    throw normalizeProviderError(err)
  }

  try {
    for await (const chunk of stream) {
      if (Date.now() > deadline) {
        throw new AppError(ERROR_CODES.AI_TIMEOUT, 'Resonance AI took too long to respond.')
      }
      const text = chunk?.text
      if (typeof text === 'string' && text.length > 0) {
        yield text
      }
      const usage = chunk?.usageMetadata
      if (usage && onUsage) {
        onUsage({
          promptTokens: usage.promptTokenCount ?? 0,
          completionTokens: usage.candidatesTokenCount ?? 0,
        })
      }
    }
  } catch (err) {
    throw normalizeProviderError(err)
  }
}

// ────────────────────────────────────────────────────────────────────────────
// STRUCTURED (JSON) GENERATION
// ────────────────────────────────────────────────────────────────────────────

/**
 * Generate structured JSON output (design generation).
 * @returns {Promise<{ data: object, usage: object }>}
 */
export async function generateJson({ systemInstruction, prompt, responseSchema, maxOutputTokens, timeoutMs }) {
  const run = () =>
    withCircuitBreaker('gemini', () =>
      genAI.models.generateContent({
        model: CONFIG.generationModel,
        contents: prompt,
        config: {
          systemInstruction,
          temperature: CONFIG.generationTemperature,
          maxOutputTokens: maxOutputTokens ?? CONFIG.generationMaxOutputTokens,
          responseMimeType: 'application/json',
          ...(responseSchema ? { responseSchema } : {}),
        },
      })
    )

  try {
    const result = await withRetry(run, {
      retries: CONFIG.chatRetries,
      onRetry: (err, attemptNo, delay) =>
        logger.warn({ err: err.message, attempt: attemptNo, delay }, 'Gemini generation retry'),
    })

    const parsed = result?.parsed ?? safeJsonExtract(result?.text)
    if (!parsed || typeof parsed !== 'object') {
      throw new AppError(ERROR_CODES.AI_INVALID_OUTPUT, 'The AI returned an unparsable response.', {
        details: { finishReason: result?.candidates?.[0]?.finishReason },
      })
    }

    const usage = result?.usageMetadata || {}
    return {
      data: parsed,
      usage: {
        promptTokens: usage.promptTokenCount ?? 0,
        completionTokens: usage.candidatesTokenCount ?? 0,
      },
    }
  } catch (err) {
    throw normalizeProviderError(err)
  }
}

function safeJsonExtract(raw) {
  if (!raw || typeof raw !== 'string') return null
  let text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  try {
    return JSON.parse(text)
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start === -1 || end <= start) return null
    try {
      return JSON.parse(text.slice(start, end + 1))
    } catch {
      return null
    }
  }
}

export { CONFIG as AI_PROVIDER_CONFIG }
