import React, { useEffect, useRef, useState } from 'react'
import { ArrowUp, ChevronDown, Plus, Square } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useChatStore } from '@/stores/chatStore'

const MODELS = [
  { id: 'resonance-1', name: 'Resonance 1.0', disabled: false },
  { id: 'resonance-pro', name: 'Resonance Pro', badge: 'Soon', disabled: true },
]

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
      <div className="rounded-2xl border bg-card text-card-foreground shadow-sm transition-colors focus-within:border-ring/60">
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
        <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
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

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {model.name}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="w-56">
                {MODELS.map((m) => (
                  <DropdownMenuItem
                    key={m.id}
                    disabled={m.disabled}
                    onSelect={() => setModel(m)}
                    className="justify-between"
                  >
                    <span className="flex items-center gap-2">
                      {m.id === model.id && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                      {m.name}
                    </span>
                    {m.badge && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                        {m.badge}
                      </span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-2.5">
            {isStreaming ? (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={stopStreaming}
                title="Stop generating"
                className="h-9 w-9 rounded-xl"
              >
                <Square size={12} fill="currentColor" />
              </Button>
            ) : (
              <Button
                type="button"
                size="icon"
                onClick={submit}
                disabled={!value.trim()}
                title="Send (Enter)"
                className="h-9 w-9 rounded-xl"
              >
                <ArrowUp size={17} strokeWidth={2.5} />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
