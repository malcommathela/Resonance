import React, { useEffect, useRef } from 'react'
import { useChatStore } from '@/stores/chatStore'
import { ChatMessage } from '@/components/chat/ChatMessage'
import { QuickActionChips } from '@/components/chat/QuickActionChips'
import { ShimmerBar } from '@/components/ui/skeletons'

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
  const scrollRef = useRef(null)
  const stickToBottom = useRef(true)

  useEffect(() => {
    if (stickToBottom.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
  }

  const lastMessage = messages[messages.length - 1]
  const showDesignChips =
    !!designContext && messages.length > 0 && !isStreamingMessage(lastMessage)

  return (
    <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        {isLoadingSession ? (
          <LoadingThread />
        ) : messages.length === 0 ? (
          <EmptyThread />
        ) : (
          messages.map((m) => <ChatMessage key={m.clientKey || m.id} message={m} />)
        )}

        {showDesignChips && <QuickActionChips variant="design" />}

        <div className="h-2" />
      </div>
    </div>
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
    <div className="flex animate-fade-in flex-col items-center pb-12 pt-[min(18vh,9rem)] text-center">
      <img
        src="/logo.png"
        alt="Resonance logo"
        className="mb-5 h-12 w-12 rounded-2xl object-cover"
      />
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Resonance workspace
      </p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">Design with clarity.</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        Explore architecture trade-offs, inspect an existing design, or describe a system to create a focused starting point.
      </p>
      <div className="mt-6">
        <QuickActionChips variant="thread" />
      </div>
    </div>
  )
}
