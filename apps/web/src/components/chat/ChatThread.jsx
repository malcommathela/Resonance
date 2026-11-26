import React from 'react'
import { useChatStore } from '@/stores/chatStore'
import { ChatMessage } from '@/components/chat/ChatMessage'
import { QuickActionChips } from '@/components/chat/QuickActionChips'
import { ShimmerBar } from '@/components/ui/skeletons'
import { Chat, ChatContent, ChatEmptyState } from '@/components/ai-elements'

const NO_MESSAGES = []

export const ChatThread = () => {
  const activeSessionId = useChatStore((s) => s.activeSessionId)
  const messages = useChatStore((s) =>
    s.activeSessionId ? s.messagesBySession[s.activeSessionId] : NO_MESSAGES
  ) || NO_MESSAGES
  const isLoadingSession = useChatStore((s) =>
    !!s._loadingSession && !(s.messagesBySession[s.activeSessionId]?.length > 0)
  )
  const designContext = useChatStore((s) => s.designContext)

  const lastMessage = messages[messages.length - 1]
  const showDesignChips =
    !!designContext && messages.length > 0 && !isStreamingMessage(lastMessage)

  return (
    <Chat>
      <ChatContent>
        {isLoadingSession ? (
          <LoadingThread />
        ) : messages.length === 0 ? (
          <EmptyThread />
        ) : (
          messages.map((m) => <ChatMessage key={m.clientKey || m.id} message={m} />)
        )}

        {showDesignChips && <QuickActionChips variant="design" />}

        <div className="h-2" />
      </ChatContent>
    </Chat>
  )
}

function LoadingThread() {
  return (
    <div className="animate-fade-in space-y-6 pt-2">
      <div className="flex justify-end">
        <ShimmerBar className="h-10 w-2/5" />
      </div>
      <div className="space-y-2">
        <ShimmerBar className="h-3.5 w-28" />
        <ShimmerBar className="h-3.5 w-full" />
        <ShimmerBar className="h-3.5 w-4/5" />
        <ShimmerBar className="h-3.5 w-3/5" />
      </div>
      <div className="flex justify-end">
        <ShimmerBar className="h-10 w-1/3" />
      </div>
    </div>
  )
}

const isStreamingMessage = (m) => !!m?.streaming || !!m?.thinking

function EmptyThread() {
  return (
    <ChatEmptyState
      icon={<img src="/logo.png" alt="Resonance logo" className="h-12 w-12 rounded-2xl object-cover" />}
      title="Design with clarity."
      description="Explore architecture trade-offs, inspect an existing design, or describe a system to create a focused starting point."
    >
      <QuickActionChips variant="thread" />
    </ChatEmptyState>
  )
}
