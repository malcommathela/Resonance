import { create } from 'zustand'
import { streamChat, retryChat, chatRest } from '@/services/chatApi'

/*
 * AI Chat state — backed by the real /chat API (apps/api).
 *
 * PostgreSQL is the source of truth: sessions and messages live server-side
 * and are fetched, never persisted to localStorage. During a send the store
 * renders optimistic messages, then reconciles against the server tail when
 * the stream settles so real message IDs and durable generation cards are in
 * place. If the browser disappears mid-stream the backend finishes the
 * operation anyway; reloading the session recovers the answer.
 */

const uid = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

const deriveTitle = (content) => {
  const clean = content.replace(/[#*`>]/g, '').replace(/\s+/g, ' ').trim()
  if (!clean) return 'New Chat'
  return clean.length > 48 ? `${clean.slice(0, 48).trimEnd()}…` : clean
}

// ── Backend → UI mappers ─────────────────────────────────────────────────────

const mapSession = (s) => ({
  id: s.id,
  title: s.title || 'New Chat',
  designId: s.designId || null,
  designName: s.design?.name || null,
  status: s.status || 'active',
  createdAt: s.createdAt,
  updatedAt: s.updatedAt,
})

const mapMessage = (m) => {
  const base = {
    id: m.id,
    role: m.role,
    content: m.content || '',
    createdAt: m.createdAt,
    sequence: m.sequence,
    requestId: m.requestId || null,
  }
  if (m.type === 'generation' && m.metadata?.design) {
    return { ...base, role: 'assistant', type: 'text', generation: m.metadata.design }
  }
  return { ...base, role: m.role, type: m.type === 'error' ? 'error' : 'text' }
}

const mapMessages = (messages) => (messages || []).map(mapMessage)

let activeController = null

export const useChatStore = create((set, get) => ({
  mode: 'landing', // 'landing' | 'active'
  sessions: [],
  sessionsLoaded: false,
  messagesBySession: {},
  activeSessionId: null,
  designContext: null, // { id, name } — design-linked conversation header
  isStreaming: false,
  _loadingSession: null,

  setMode: (mode) => set({ mode }),

  // Return to the hero view without destroying the active conversation
  returnToLanding: () => set({ mode: 'landing' }),

  // ── Sessions ──────────────────────────────────────────────────────────────

  loadSessions: async ({ silent = false } = {}) => {
    if (!silent && !get().sessionsLoaded) set({ sessionsLoaded: false })
    try {
      const data = await chatRest.listSessions(50)
      set({ sessions: (data.sessions || []).map(mapSession), sessionsLoaded: true })
    } catch {
      if (!silent) set({ sessionsLoaded: true })
    }
  },

  /*
   * "New conversation": a local draft. The backend session is created lazily
   * on the first message (so clicking the button never spams the DB).
   */
  createSession: () => {
    set({ activeSessionId: null, designContext: null, mode: 'active' })
    return null
  },

  // Entry point for "Chat about this design" (Dashboard / Design Detail / Landing)
  startDesignChat: async (design) => {
    if (!design?.id) return null
    const existing = get().sessions.find((s) => s.designId === design.id && s.status === 'active')
    if (existing) {
      await get().loadSession(existing.id)
      set({ mode: 'active' })
      return existing
    }

    const created = await chatRest.createSession({ designId: design.id })
    const session = mapSession(created)
    set((s) => ({
      sessions: [session, ...s.sessions.filter((x) => x.id !== session.id)],
      messagesBySession: { ...s.messagesBySession, [session.id]: [] },
      activeSessionId: session.id,
      designContext: created.design ? { id: created.design.id, name: created.design.name } : { id: design.id, name: design.name },
      mode: 'active',
    }))
    return session
  },

  loadSession: async (id) => {
    set({ activeSessionId: id, mode: 'active' })
    if (get()._loadingSession === id) return
    const controller = Symbol(id)
    set({ _loadingSession: controller })
    try {
      const [sessionData, messageData] = await Promise.all([
        chatRest.getSession(id).catch(() => null),
        chatRest.getMessages(id, { limit: 50 }),
      ])
      if (get()._loadingSession !== controller || get().activeSessionId !== id) return

      const design = sessionData?.design || null
      set((s) => ({
        messagesBySession: { ...s.messagesBySession, [id]: mapMessages(messageData.messages) },
        designContext: design ? { id: design.id, name: design.name } : null,
        sessions: s.sessions.map((x) => (x.id === id ? { ...mapSession(sessionData || x), id } : x)),
        _loadingSession: null,
      }))
    } catch {
      if (get()._loadingSession === controller) set({ _loadingSession: null })
      set((s) => ({ messagesBySession: { ...s.messagesBySession, [id]: s.messagesBySession[id] || [] } }))
    }
  },

  deleteSession: async (id) => {
    const { activeSessionId } = get()
    set((s) => {
      const messagesBySession = { ...s.messagesBySession }
      delete messagesBySession[id]
      return {
        sessions: s.sessions.filter((x) => x.id !== id),
        messagesBySession,
        ...(activeSessionId === id
          ? { activeSessionId: null, designContext: null, mode: 'landing' }
          : {}),
      }
    })
    try {
      await chatRest.deleteSession(id)
    } catch {
      get().loadSessions({ silent: true })
    }
  },

  renameSession: (id, title) => {
    const clean = (title || '').trim()
    if (!clean) return
    set((s) => ({ sessions: s.sessions.map((x) => (x.id === id ? { ...x, title: clean } : x)) }))
    chatRest.patchSession(id, { title: clean }).catch(() => {})
  },

  // ── Messaging ─────────────────────────────────────────────────────────────

  _patchMessage: (sessionId, messageId, patch) =>
    set((s) => {
      const msgs = s.messagesBySession[sessionId]
      if (!msgs) return s
      const idx = msgs.findIndex((m) => m.id === messageId)
      if (idx === -1) return s
      const next = [...msgs]
      next[idx] = { ...next[idx], ...patch }
      return { messagesBySession: { ...s.messagesBySession, [sessionId]: next } }
    }),

  _appendToMessage: (sessionId, messageId, text) =>
    set((s) => {
      const msgs = s.messagesBySession[sessionId]
      if (!msgs) return s
      const idx = msgs.findIndex((m) => m.id === messageId)
      if (idx === -1) return s
      const next = [...msgs]
      next[idx] = { ...next[idx], content: (next[idx].content || '') + text }
      return { messagesBySession: { ...s.messagesBySession, [sessionId]: next } }
    }),

  sendMessage: async (content, opts = {}) => {
    const trimmed = (content || '').trim()
    const state = get()
    if (state.isStreaming || !trimmed) return

    // Flow A (spec §10): prompt_submit transitions LANDING -> ACTIVE chat.
    // Set immediately so the view switches before any network await.
    set({ mode: 'active' })

    // Draft → real session on first message.
    let sessionId = state.activeSessionId
    const known = state.sessions.find((s) => s.id === sessionId)
    if (!sessionId || !known) {
      const created = await chatRest.createSession({ title: deriveTitle(trimmed) })
      const session = mapSession(created)
      set((s) => ({
        sessions: [session, ...s.sessions],
        activeSessionId: session.id,
        messagesBySession: { ...s.messagesBySession, [session.id]: [] },
        mode: 'active',
      }))
      sessionId = session.id
    }

    const now = new Date().toISOString()
    const userMsg = { id: uid('tmpu'), role: 'user', type: 'text', content: trimmed, createdAt: now }
    const assistantId = uid('tmpa')
    const assistantMsg = {
      id: assistantId,
      role: 'assistant',
      type: 'text',
      content: '',
      streaming: true,
      useDesignSystem: !!opts.useDesignSystem,
      createdAt: now,
    }

    set((s) => ({
      messagesBySession: {
        ...s.messagesBySession,
        [sessionId]: [...(s.messagesBySession[sessionId] || []), userMsg, assistantMsg],
      },
      isStreaming: true,
    }))

    await get()._runAssistant(sessionId, assistantId, {
      kind: 'send',
      content: trimmed,
      useDesignSystem: !!opts.useDesignSystem,
    })
  },

  // Re-run the turn that produced this assistant/error message (spec §80):
  // retries server-side for the SAME user message — no duplicate user bubble.
  regenerate: async (messageId) => {
    const { activeSessionId: sessionId, messagesBySession, isStreaming } = get()
    if (isStreaming || !sessionId) return
    const msgs = messagesBySession[sessionId] || []
    const idx = msgs.findIndex((m) => m.id === messageId)
    if (idx === -1) return

    let userIdx = idx - 1
    while (userIdx >= 0 && msgs[userIdx].role !== 'user') userIdx -= 1
    if (userIdx < 0) return
    const userMsg = msgs[userIdx]
    if (userMsg.id.startsWith('tmp')) return // not yet reconciled — nothing to retry server-side

    const useDesignSystem = !!msgs[idx]?.useDesignSystem
    const assistantId = uid('tmpa')

    set((s) => ({
      messagesBySession: {
        ...s.messagesBySession,
        [sessionId]: [
          ...msgs.slice(0, userIdx + 1),
          { id: assistantId, role: 'assistant', type: 'text', content: '', streaming: true, useDesignSystem, createdAt: new Date().toISOString() },
        ],
      },
      isStreaming: true,
    }))

    await get()._runAssistant(sessionId, assistantId, {
      kind: 'retry',
      userMessageId: userMsg.id,
      useDesignSystem,
    })
  },

  _runAssistant: async (sessionId, assistantId, { kind, content, userMessageId, useDesignSystem }) => {
    const controller = new AbortController()
    activeController = controller

    const patch = (p) => get()._patchMessage(sessionId, assistantId, p)
    const append = (text) => get()._appendToMessage(sessionId, assistantId, text)

    const onEvent = (evt) => {
      switch (evt.type) {
        case 'thinking':
          patch({ thinking: evt.label })
          break
        case 'chunk':
          append(evt.content)
          break
        case 'generation':
          patch({ generation: evt.design })
          break
        case 'error':
          patch({ type: 'error', content: evt.message, thinking: null })
          break
        default:
          break
      }
    }

    try {
      if (kind === 'retry') {
        await retryChat({ sessionId, userMessageId, signal: controller.signal, onEvent })
      } else {
        await streamChat({ sessionId, content, useDesignSystem, signal: controller.signal, onEvent })
      }
    } catch (err) {
      if (err?.name === 'AbortError') {
        patch({ stopped: true })
      } else {
        patch({ type: 'error', content: err?.message || 'Something went wrong.', thinking: null })
      }
    } finally {
      activeController = null
      patch({ streaming: false, thinking: null })
      set({ isStreaming: false })
      await get()._reconcile(sessionId)
    }
  },

  /*
   * Server is the source of truth once the stream settles: replace the local
   * thread with persisted messages (real IDs, durable generation cards) and
   * refresh the session list (server-derived title, ordering).
   */
  _reconcile: async (sessionId) => {
    try {
      const [messageData, sessionData] = await Promise.all([
        chatRest.getMessages(sessionId, { limit: 50 }),
        chatRest.getSession(sessionId).catch(() => null),
      ])
      set((s) => {
        if (s.activeSessionId !== sessionId) return s
        const updates = { messagesBySession: { ...s.messagesBySession, [sessionId]: mapMessages(messageData.messages) } }
        if (sessionData) {
          const mapped = mapSession(sessionData)
          updates.sessions = s.sessions.map((x) => (x.id === sessionId ? mapped : x))
          if (sessionData.design) updates.designContext = { id: sessionData.design.id, name: sessionData.design.name }
        }
        return updates
      })
      get().loadSessions({ silent: true })
    } catch {
      /* keep optimistic state — next load heals */
    }
  },

  stopStreaming: () => activeController?.abort(),

  // Hide the generation card locally; the design stays durable server-side.
  discardGeneration: (messageId) => {
    const sessionId = get().activeSessionId
    if (!sessionId) return
    get()._patchMessage(sessionId, messageId, { generation: null })
  },
}))
