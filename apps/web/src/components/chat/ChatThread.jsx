import React, { useEffect, useRef } from 'react'
import { Zap } from 'lucide-react'
import { useChatStore } from '@/stores/chatStore'
import { ChatMessage } from '@/components/chat/ChatMessage'
import { QuickActionChips } from '@/components/chat/QuickActionChips'

const NO_MESSAGES = []

/* Scrollable conversation body with bottom-sticky auto-scroll */
export const ChatThread = () => {
  const activeSessionId = useChatStore((s) => s.activeSessionId)
  const messages = useChatStore((s) =>
    s.activeSessionId ? s.messagesBySession[s.activeSessionId] : NO_MESSAGES
  ) || NO_MESSAGES
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
    <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto min-h-0">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {messages.length === 0 ? (
          <EmptyThread />
        ) : (
          messages.map((m) => <ChatMessage key={m.id} message={m} />)
        )}

        {showDesignChips && <QuickActionChips variant="design" />}

        <div className="h-2" />
      </div>
    </div>
  )
}

const isStreamingMessage = (m) => !!m?.streaming || !!m?.thinking

function EmptyThread() {
  return (
    <div className="flex flex-col items-center text-center pt-14 animate-fade-in">
      <div className="w-12 h-12 rounded-2xl bg-resonance-accent flex items-center justify-center mb-4">
        <Zap size={22} className="text-resonance-neutral" strokeWidth={2.5} />
      </div>
      <h2 className="text-xl font-semibold text-resonance-text-primary">New conversation</h2>
      <p className="mt-1.5 text-sm text-resonance-text-secondary max-w-sm">
        Ask about architecture patterns, analyze a design, or describe a system to generate.
      </p>
      <div className="mt-6">
        <QuickActionChips variant="thread" />
      </div>
    </div>
  )
}
