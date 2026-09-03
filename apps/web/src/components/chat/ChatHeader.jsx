import React from 'react'
import { ExternalLink, Network } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useChatStore } from '@/stores/chatStore'

/* Slim header for the active conversation (brand + collapse live in ChatSidebar) */
export const ChatHeader = () => {
  const navigate = useNavigate()
  const session = useChatStore((s) => s.sessions.find((x) => x.id === s.activeSessionId))
  const designContext = useChatStore((s) => s.designContext)

  return (
    <header className="h-14 shrink-0 border-b border-resonance-border flex items-center justify-between px-5 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-resonance-text-primary truncate">
            {session?.title || 'New Chat'}
          </h1>
          {designContext && (
            <p className="text-[11px] text-resonance-text-muted flex items-center gap-1 truncate">
              <Network size={10} className="text-resonance-accent" />
              Discussing {designContext.name}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {designContext && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate(`/designs/${designContext.id}`)}
            className="text-xs gap-1.5 hidden sm:inline-flex"
          >
            <ExternalLink size={12} />
            View design
          </Button>
        )}
        <ThemeToggle />
      </div>
    </header>
  )
}
