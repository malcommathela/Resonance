import React from 'react'
import { ChatSidebar } from '@/components/chat/ChatSidebar'
import { ChatHeader } from '@/components/chat/ChatHeader'
import { ChatThread } from '@/components/chat/ChatThread'
import { ChatComposer } from '@/components/chat/ChatComposer'

export const ChatWorkspace = () => (
  <div className="flex h-screen overflow-hidden bg-background text-foreground">
    <ChatSidebar />
    <div className="flex min-w-0 flex-1 flex-col">
      <ChatHeader />
      <ChatThread />
      <div className="shrink-0 px-4 pb-3 pt-1">
        <div className="mx-auto max-w-3xl">
          <ChatComposer variant="compact" />
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Review generated architecture before implementation. Resonance can make mistakes.
          </p>
        </div>
      </div>
    </div>
  </div>
)
