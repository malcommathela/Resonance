import React, { useEffect, useState } from 'react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { ChatSidebar } from '@/components/chat/ChatSidebar'
import { ChatHeader } from '@/components/chat/ChatHeader'
import { ChatThread } from '@/components/chat/ChatThread'
import { ChatComposer } from '@/components/chat/ChatComposer'
import { useChatStore } from '@/stores/chatStore'

export const ChatWorkspace = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const activeSessionId = useChatStore((s) => s.activeSessionId)

  useEffect(() => {
    setSidebarOpen(false)
  }, [activeSessionId])

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background text-foreground">
      <div className="hidden lg:flex">
        <ChatSidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <ChatHeader onOpenSidebar={() => setSidebarOpen(true)} />
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
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent title="Conversations" className="w-[288px] p-0 sm:max-w-sm">
          <ChatSidebar mobile onNavigate={() => setSidebarOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  )
}
