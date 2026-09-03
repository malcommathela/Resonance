import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  MoreHorizontal, Network, PanelLeftClose, PanelLeftOpen,
  Pencil, Plus, Search, Trash2, Zap,
} from 'lucide-react'
import { useChatStore } from '@/stores/chatStore'
import { useAuthStore } from '@/stores/authStore'
import { ProfileDropdown } from '@/components/ui/ProfileDropdown'

const DAY_MS = 86400000
const COLLAPSE_KEY = 'resonance-chat-sidebar-collapsed'

const groupLabel = (updatedAt) => {
  const t = new Date(updatedAt).getTime()
  const startOfToday = new Date().setHours(0, 0, 0, 0)
  if (t >= startOfToday) return 'Today'
  if (t >= startOfToday - DAY_MS) return 'Yesterday'
  if (t >= startOfToday - 7 * DAY_MS) return 'Previous 7 Days'
  return 'Older'
}

/* One conversation row — hover "…" menu with Rename (inline) + Delete */
const ConversationItem = ({ session, active, onOpen, onRename, onDelete }) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(session.title)
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const startRename = () => {
    setDraft(session.title)
    setMenuOpen(false)
    setEditing(true)
  }

  const commitRename = () => {
    const clean = draft.trim()
    if (clean && clean !== session.title) onRename(clean)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitRename}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitRename()
          if (e.key === 'Escape') setEditing(false)
        }}
        className="w-full px-3 py-2 rounded-lg text-[13px] font-medium bg-resonance-bg-tertiary border border-resonance-accent/60 text-resonance-text-primary outline-none"
        onClick={(e) => e.stopPropagation()}
      />
    )
  }

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onOpen}
        title={session.title}
        className={`w-full flex items-center gap-2.5 pl-3 pr-8 py-2 rounded-lg text-left transition-all duration-150 ${
          active
            ? 'bg-resonance-accent text-resonance-neutral'
            : 'text-resonance-text-secondary hover:bg-resonance-bg-hover hover:text-resonance-text-primary'
        }`}
      >
        {session.designId && (
          <Network
            size={13}
            className={`shrink-0 ${active ? 'text-resonance-neutral' : 'text-resonance-accent'}`}
          />
        )}
        <span className="flex-1 text-[13px] font-medium truncate">{session.title}</span>
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setMenuOpen((v) => !v)
        }}
        title="More options"
        className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md transition-all ${
          active
            ? 'opacity-0 group-hover:opacity-100 text-resonance-neutral hover:bg-black/10'
            : 'opacity-0 group-hover:opacity-100 text-resonance-text-muted hover:text-resonance-text-primary hover:bg-resonance-bg-tertiary'
        } ${menuOpen ? 'opacity-100' : ''}`}
      >
        <MoreHorizontal size={14} />
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-1 top-full mt-1 z-50 w-40 rounded-xl border border-resonance-border bg-resonance-bg-elevated shadow-xl p-1 animate-scale-in">
            <button
              type="button"
              onClick={startRename}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-resonance-text-primary hover:bg-resonance-bg-hover transition-colors"
            >
              <Pencil size={13} />
              Rename
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                if (window.confirm(`Delete "${session.title}"?`)) onDelete()
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={13} />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/*
 * Conversations sidebar (ChatGPT/Claude conventions) — only rendered inside
 * active chat sessions. Collapses to an icon rail; collapse state persists.
 */
export const ChatSidebar = () => {
  const sessions = useChatStore((s) => s.sessions)
  const activeSessionId = useChatStore((s) => s.activeSessionId)
  const loadSession = useChatStore((s) => s.loadSession)
  const loadSessions = useChatStore((s) => s.loadSessions)
  const createSession = useChatStore((s) => s.createSession)
  const deleteSession = useChatStore((s) => s.deleteSession)
  const renameSession = useChatStore((s) => s.renameSession)
  const returnToLanding = useChatStore((s) => s.returnToLanding)
  const { user, logout } = useAuthStore()

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })
  const [query, setQuery] = useState('')
  const searchRef = useRef(null)

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      } catch {
        /* storage unavailable */
      }
      return next
    })
  }

  const expandAndSearch = () => {
    setCollapsed(false)
    requestAnimationFrame(() => searchRef.current?.focus())
  }

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? sessions.filter((s) => s.title.toLowerCase().includes(q))
      : sessions
    const map = new Map()
    for (const session of filtered) {
      const label = groupLabel(session.updatedAt)
      if (!map.has(label)) map.set(label, [])
      map.get(label).push(session)
    }
    return Array.from(map.entries())
  }, [sessions, query])

  const railButton =
    'w-9 h-9 rounded-lg flex items-center justify-center text-resonance-text-secondary hover:text-resonance-text-primary hover:bg-resonance-bg-hover transition-all'

  /* ---------- Collapsed icon rail ---------- */
  if (collapsed) {
    return (
      <aside className="w-[60px] shrink-0 border-r border-resonance-border bg-resonance-bg-secondary flex flex-col items-center py-3 gap-1.5 h-full transition-[width] duration-200">
        <button type="button" onClick={toggleCollapsed} title="Expand sidebar" className={railButton}>
          <PanelLeftOpen size={18} />
        </button>
        <button type="button" onClick={() => createSession()} title="New conversation" className={`${railButton} bg-resonance-accent text-resonance-neutral hover:bg-resonance-accent-hover`}>
          <Plus size={18} />
        </button>
        <button type="button" onClick={expandAndSearch} title="Search conversations" className={railButton}>
          <Search size={17} />
        </button>

        <div className="flex-1" />

        <button
          type="button"
          onClick={toggleCollapsed}
          title={user?.name || 'Profile'}
          className="w-9 h-9 rounded-full bg-resonance-accent p-0.5 hover:opacity-90 transition-opacity"
        >
          <img
            src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user?.email || user?.name || 'resonance-user')}`}
            alt={user?.name || 'Profile'}
            className="h-full w-full rounded-full object-cover bg-resonance-bg-secondary"
          />
        </button>
      </aside>
    )
  }

  /* ---------- Expanded sidebar ---------- */
  return (
    <aside className="w-[264px] shrink-0 border-r border-resonance-border bg-resonance-bg-secondary flex flex-col h-full transition-[width] duration-200">
      {/* Header: brand (back to landing) + collapse */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <button
          type="button"
          onClick={returnToLanding}
          className="flex items-center gap-2 rounded-lg px-1 py-1 hover:opacity-90 transition-opacity"
          title="Back to Home"
        >
          <span className="w-7 h-7 rounded-lg bg-resonance-accent flex items-center justify-center">
            <Zap size={14} className="text-resonance-neutral" strokeWidth={2.5} />
          </span>
          <span className="text-[15px] font-bold tracking-tight text-resonance-text-primary">
            Resonance
          </span>
        </button>
        <button
          type="button"
          onClick={toggleCollapsed}
          title="Collapse sidebar"
          className="p-2 rounded-lg text-resonance-text-secondary hover:text-resonance-text-primary hover:bg-resonance-bg-hover transition-all"
        >
          <PanelLeftClose size={16} />
        </button>
      </div>

      {/* New chat + search */}
      <div className="px-3 space-y-2.5">
        <button
          type="button"
          onClick={() => createSession()}
          className="w-full btn-primary flex items-center justify-center gap-2 text-sm"
        >
          <Plus size={16} />
          New conversation
        </button>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-resonance-text-muted" />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations"
            className="w-full pl-8 pr-3 py-2 text-[13px] rounded-lg bg-resonance-bg-tertiary border border-resonance-border text-resonance-text-primary placeholder:text-resonance-text-muted outline-none focus:border-resonance-accent/50 transition-colors"
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2 pt-3 pb-2 min-h-0">
        {groups.length === 0 ? (
          <p className="text-xs text-resonance-text-muted text-center px-3 py-8">
            {query ? 'No conversations match your search' : 'No conversations yet'}
          </p>
        ) : (
          groups.map(([label, items]) => (
            <div key={label} className="mb-3">
              <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-resonance-text-muted">
                {label}
              </div>
              <div className="space-y-0.5">
                {items.map((session) => (
                  <ConversationItem
                    key={session.id}
                    session={session}
                    active={session.id === activeSessionId}
                    onOpen={() => loadSession(session.id)}
                    onRename={(title) => renameSession(session.id, title)}
                    onDelete={() => deleteSession(session.id)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Account */}
      <div className="border-t border-resonance-border p-3">
        <ProfileDropdown user={user} onSignOut={logout} />
      </div>
    </aside>
  )
}
