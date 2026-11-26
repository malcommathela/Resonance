import React, { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  ModelSelector, MODELS, PromptInput, PromptInputSubmit, PromptInputToolbar,
} from '@/components/ai-elements'
import { useChatStore } from '@/stores/chatStore'

export const ChatComposer = ({ variant = 'compact', autoFocus = false }) => {
  const [value, setValue] = useState('')
  const [model, setModel] = useState(MODELS[0])
  const isStreaming = useChatStore((s) => s.isStreaming)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const stopStreaming = useChatStore((s) => s.stopStreaming)
  const textareaRef = useRef(null)
  const isHero = variant === 'hero'

  const autoResize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, isHero ? 220 : 160)}px`
  }

  useEffect(() => {
    autoResize()
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const prefill = (e) => {
      setValue(e.detail || '')
      textareaRef.current?.focus()
    }
    window.addEventListener('resonance:chat-prefill', prefill)
    return () => window.removeEventListener('resonance:chat-prefill', prefill)
  }, [])

  const submit = () => {
    if (!value.trim() || isStreaming) return
    sendMessage(value, { useDesignSystem: true })
    setValue('')
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="w-full">
      <PromptInput>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          rows={isHero ? 2 : 1}
          autoFocus={autoFocus}
          placeholder={isHero ? 'Describe what you want to create…' : 'Ask Resonance anything…'}
          className="w-full resize-none bg-transparent px-4 pb-1 pt-4 text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
        />
        <PromptInputToolbar>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Attach context (coming soon)"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <ModelSelector value={model} onChange={setModel} />
          </div>
          <PromptInputSubmit
            streaming={isStreaming}
            disabled={!value.trim()}
            onSubmit={submit}
            onStop={stopStreaming}
          />
        </PromptInputToolbar>
      </PromptInput>
    </div>
  )
}
