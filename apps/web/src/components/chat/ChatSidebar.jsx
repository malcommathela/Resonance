import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  MoreHorizontal, Network, PanelLeftClose, PanelLeftOpen,
  Pencil, Plus, Search, Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ProfileDropdown } from '@/components/ui/ProfileDropdown'
import { ShimmerBar } from '@/components/ui/skeletons'
import { useChatStore } from '@/stores/chatStore'
import { useAuthStore } from '@/stores/authStore'

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

const ConversationItem = ({ session, active, onOpen, onRename, onDelete }) => {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(session.title)
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const startRename = () => {
    setDraft(session.title)
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
        className="w-full rounded-md border border-ring bg-background px-3 py-2 text-[13px] font-medium text-foreground outline-none"
        onClick={(e) => e.stopPropagation()}
      />
    )
  }

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onOpen}
        title={session.title}
        className={`flex w-full items-center gap-2.5 rounded-md py-2 pl-3 pr-8 text-left transition-colors ${
          active
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        }`}
      >
        {session.designId && (
          <Network
            size={13}
            className={`shrink-0 ${active ? 'text-primary-foreground' : 'text-primary'}`}
          />
        )}
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{session.title}</span>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            title="More options"
            className={`absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100 ${
              active
                ? 'text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground'
                : 'text-muted-foreground'
            }`}
          >
            <MoreHorizontal size={14} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onSelect={startRename} className="gap-2 text-[13px]">
            <Pencil size={13} />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              if (window.confirm(`Delete "${session.title}"?`)) onDelete()
            }}
            className="gap-2 text-[13px] text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            <Trash2 size={13} />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

const SKELETON_WIDTHS = ['w-4/5', 'w-3/5', 'w-11/12', 'w-2/3', 'w-3/4', 'w-1/2']

const ConversationListSkeleton = () => (
  <div aria-hidden="true">
    <div className="px-3 py-1.5">
      <ShimmerBar className="h-3 w-14" />
    </div>
    <div className="space-y-0.5">
      {SKELETON_WIDTHS.map((w) => (
        <div key={w} className="flex items-center gap-2.5 py-2 pl-3 pr-8">
          <ShimmerBar className={`h-[13px] ${w}`} />
        </div>
      ))}
    </div>
  </div>
)

export const ChatSidebar = ({ onNavigate, mobile = false }) => {
  const sessions = useChatStore((s) => s.sessions)
  const sessionsLoaded = useChatStore((s) => s.sessionsLoaded)
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

  const [collapsedState, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })
  const [query, setQuery] = useState('')
  const searchRef = useRef(null)

  const collapsed = mobile ? false : collapsedState

  const toggleCollapsed = () => {
    if (mobile) return
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
    onNavigate?.()
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

  if (collapsed) {
    return (
      <aside className="flex h-full w-[60px] shrink-0 flex-col items-center gap-1.5 border-r bg-card py-3 transition-[width] duration-200">
        <Button variant="ghost" size="icon" onClick={toggleCollapsed} title="Expand sidebar">
          <PanelLeftOpen size={18} />
        </Button>
        <Button size="icon" onClick={() => { createSession(); onNavigate?.() }} title="New conversation">
          <Plus size={18} />
        </Button>
        <Button variant="ghost" size="icon" onClick={expandAndSearch} title="Search conversations">
          <Search size={17} />
        </Button>

        <div className="flex-1" />

        <ProfileDropdown user={user} onSignOut={logout} avatarOnly />
      </aside>
    )
  }

  return (
    <aside className={`flex h-full shrink-0 flex-col border-r bg-card transition-[width] duration-200 ${mobile ? 'w-full border-r-0' : 'w-[264px]'}`}>
      <div className="flex items-center justify-between px-3 pb-2 pt-3">
        <button
          type="button"
          onClick={() => { returnToLanding(); onNavigate?.() }}
          className="flex items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-accent"
          title="Back to Home"
        >
          <img
            src="/logo.png"
            alt="Resonance logo"
            className="h-7 w-7 rounded-lg object-cover"
          />
          <span className="text-[15px] font-bold tracking-tight text-foreground">
            Resonance
          </span>
        </button>
        <Button variant="ghost" size="icon" onClick={toggleCollapsed} title="Collapse sidebar" className={`h-8 w-8 ${mobile ? 'hidden' : ''}`}>
          <PanelLeftClose size={16} />
        </Button>
      </div>

      <div className="space-y-2.5 px-3">
        <Button onClick={() => { createSession(); onNavigate?.() }} className="w-full gap-2">
          <Plus size={16} />
          New conversation
        </Button>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations"
            className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
          />
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1" aria-busy={!sessionsLoaded}>
        <div className="px-2 pb-2 pt-3">
          {!sessionsLoaded && sessions.length === 0 ? (
            <ConversationListSkeleton />
          ) : groups.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">
              {query ? 'No conversations match your search' : 'No conversations yet'}
            </p>
          ) : (
            groups.map(([label, items]) => (
              <div key={label} className="mb-3">
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {label}
                </div>
                <div className="space-y-0.5">
                  {items.map((session) => (
                    <ConversationItem
                      key={session.id}
                      session={session}
                      active={session.id === activeSessionId}
                      onOpen={() => { loadSession(session.id); onNavigate?.() }}
                      onRename={(title) => renameSession(session.id, title)}
                      onDelete={() => deleteSession(session.id)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <div className="border-t p-3">
        <ProfileDropdown user={user} onSignOut={logout} />
      </div>
    </aside>
  )
}
