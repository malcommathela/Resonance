import React, { useState } from 'react'
import { AlertCircle, Check, Copy, RefreshCw, Zap } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer'
import { ThinkingIndicator } from '@/components/chat/ThinkingIndicator'
import { GenerationCard } from '@/components/chat/GenerationCard'
import { useChatStore } from '@/stores/chatStore'

/*
 * Claude-style message rendering:
 *  - user: right-aligned accent bubble
 *  - assistant: full-width markdown with avatar, hover actions, streaming caret
 *  - type="error": red panel with retry
 */
export const ChatMessage = ({ message }) => {
  const regenerate = useChatStore((s) => s.regenerate)
  const [copied, setCopied] = useState(false)

  if (message.role === 'user') {
    return (
      <div className="flex justify-end animate-fade-in">
        <div className="max-w-[75%] rounded-2xl rounded-br-md bg-resonance-accent text-resonance-neutral px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
        </div>
      </div>
    )
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="flex gap-3 animate-fade-in group">
      <div className="w-8 h-8 rounded-lg bg-resonance-accent flex items-center justify-center shrink-0 mt-0.5">
        <Zap size={15} className="text-resonance-neutral" strokeWidth={2.5} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[13px] font-semibold text-resonance-text-primary">Resonance</span>
          {message.stopped && (
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-resonance-bg-tertiary text-resonance-text-muted">
              stopped
            </span>
          )}
        </div>

        {message.type === 'error' ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-start gap-2.5 max-w-xl">
            <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
            <p className="flex-1 text-sm text-red-500 leading-relaxed">{message.content}</p>
            <Button size="sm" variant="secondary" onClick={() => regenerate(message.id)} className="text-xs shrink-0 gap-1.5">
              <RefreshCw size={12} />
              Retry
            </Button>
          </div>
        ) : (
          <>
            {message.thinking && <ThinkingIndicator label={message.thinking} />}

            {message.content && (
              <div className="text-resonance-text-primary">
                <MarkdownRenderer
                  content={message.content + (message.streaming && !message.thinking ? ' ▍' : '')}
                />
              </div>
            )}

            {message.generation && <GenerationCard generation={message.generation} messageId={message.id} />}

            {!message.streaming && message.content && (
              <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={copy}
                  title="Copy"
                  className="p-1.5 rounded-md text-resonance-text-muted hover:text-resonance-text-primary hover:bg-resonance-bg-hover transition-all"
                >
                  {copied ? <Check size={14} className="text-resonance-accent" /> : <Copy size={14} />}
                </button>
                <button
                  type="button"
                  onClick={() => regenerate(message.id)}
                  title="Regenerate"
                  className="p-1.5 rounded-md text-resonance-text-muted hover:text-resonance-text-primary hover:bg-resonance-bg-hover transition-all"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
