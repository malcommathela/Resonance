import React, { useState } from 'react'
import { AlertCircle, Check, Copy, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer'
import { GenerationCard } from '@/components/chat/GenerationCard'
import {
  Message, MessageContent, MessageActions, MessageAction, Reasoning,
} from '@/components/ai-elements'
import { useChatStore } from '@/stores/chatStore'

export const ChatMessage = ({ message }) => {
  const regenerate = useChatStore((s) => s.regenerate)
  const [copied, setCopied] = useState(false)

  if (message.role === 'user') {
    return (
      <Message from="user">
        <MessageContent className="max-w-[75%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[15px] leading-relaxed text-primary-foreground">
          {message.content}
        </MessageContent>
      </Message>
    )
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      return
    }
  }

  return (
    <Message>
      <MessageContent>
        {message.stopped && (
          <Badge variant="secondary" className="mb-2 text-[11px] font-normal">
            Generation stopped
          </Badge>
        )}

        {message.type === 'error' ? (
          <div className="flex max-w-xl items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-destructive" />
            <p className="flex-1 text-sm leading-relaxed text-destructive">{message.content}</p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => regenerate(message.id)}
              className="shrink-0 gap-1.5 text-xs"
            >
              <RefreshCw size={12} />
              Retry
            </Button>
          </div>
        ) : (
          <>
            {(message.thinking || (message.streaming && !message.content)) && (
              <Reasoning
                text={message.thinking || ''}
                streaming={!!message.streaming}
                label={message.thinking || 'Thinking'}
              />
            )}

            {message.content && (
              <div className="text-foreground">
                <MarkdownRenderer
                  content={message.content + (message.streaming && !message.thinking ? ' ▍' : '')}
                />
              </div>
            )}

            {message.generation && <GenerationCard generation={message.generation} messageId={message.id} />}

            {!message.streaming && message.content && (
              <MessageActions>
                <MessageAction
                  label="Copy"
                  icon={copied ? Check : Copy}
                  active={copied}
                  onClick={copy}
                />
                <MessageAction label="Regenerate" icon={RefreshCw} onClick={() => regenerate(message.id)} />
              </MessageActions>
            )}
          </>
        )}
      </MessageContent>
    </Message>
  )
}
