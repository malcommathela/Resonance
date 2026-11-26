import React from 'react'
import { ExternalLink, Network } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useChatStore } from '@/stores/chatStore'

export const ChatHeader = () => {
  const navigate = useNavigate()
  const session = useChatStore((s) => s.sessions.find((x) => x.id === s.activeSessionId))
  const designContext = useChatStore((s) => s.designContext)

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-foreground">
            {session?.title || 'New Chat'}
          </h1>
          {designContext && (
            <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
              <Network size={10} className="text-primary" />
              Discussing {designContext.name}
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {designContext && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate(`/designs/${designContext.id}`)}
            className="hidden gap-1.5 text-xs sm:inline-flex"
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
