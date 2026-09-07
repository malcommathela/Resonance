import React from 'react'
import { ChatSidebar } from '@/components/chat/ChatSidebar'
import { ChatHeader } from '@/components/chat/ChatHeader'
import { ChatThread } from '@/components/chat/ChatThread'
import { ChatComposer } from '@/components/chat/ChatComposer'

/* Persistent chat layout. Do not conditionally replace this tree while a
 * conversation is being created or streamed. */
export const ChatWorkspace = () => (
  <div className="flex h-screen overflow-hidden">
    <ChatSidebar />
    <div className="flex-1 flex flex-col min-w-0">
      <ChatHeader />
      <ChatThread />
      <div className="shrink-0 px-4 pb-3 pt-1">
        <div className="max-w-3xl mx-auto">
          <ChatComposer variant="compact" />
          <p className="mt-2 text-center text-[11px] text-resonance-text-muted">
            Review generated architecture before implementation. Resonance can make mistakes.
          </p>
        </div>
      </div>
    </div>
  </div>
)
