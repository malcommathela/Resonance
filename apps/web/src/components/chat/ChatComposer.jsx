import React, { useEffect, useRef, useState } from 'react'
import { ArrowUp, ChevronDown, Layers, Plus, Square } from 'lucide-react'
import { useChatStore } from '@/stores/chatStore'

const MODELS = [
  { id: 'resonance-1', name: 'Resonance 1.0', disabled: false },
  { id: 'resonance-pro', name: 'Resonance Pro', badge: 'Soon', disabled: true },
]

/*
 * Shared composer for both layouts:
 *  - variant="hero"    → landing hero (large, centered)
 *  - variant="compact" → docked at the bottom of the active thread
 * Chips prefill it via the 'resonance:chat-prefill' CustomEvent.
 */
export const ChatComposer = ({ variant = 'compact', autoFocus = false }) => {
  const [value, setValue] = useState('')
  const [useDesignSystem, setUseDesignSystem] = useState(true)
  const [model, setModel] = useState(MODELS[0])
  const [modelOpen, setModelOpen] = useState(false)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const stopStreaming = useChatStore((s) => s.stopStreaming)
  const textareaRef = useRef(null)
  const modelMenuRef = useRef(null)
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

  useEffect(() => {
    if (!modelOpen) return
    const onOutside = (e) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target)) setModelOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [modelOpen])

  const submit = () => {
    if (!value.trim() || isStreaming) return
    sendMessage(value, { useDesignSystem })
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
      <div className="rounded-2xl border border-resonance-border bg-resonance-bg-elevated shadow-[0_8px_30px_rgba(0,0,0,0.12)] transition-colors focus-within:border-resonance-accent/40">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          rows={isHero ? 2 : 1}
          autoFocus={autoFocus}
          placeholder={isHero ? 'Describe what you want to create…' : 'Ask Resonance anything…'}
          className="w-full bg-transparent resize-none outline-none text-[15px] leading-relaxed text-resonance-text-primary placeholder:text-resonance-text-muted px-4 pt-4 pb-1"
        />
        <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              title="Attach context (coming soon)"
              className="p-2 rounded-lg text-resonance-text-secondary hover:text-resonance-text-primary hover:bg-resonance-bg-hover transition-all"
            >
              <Plus size={16} />
            </button>

            <div className="relative" ref={modelMenuRef}>
              <button
                type="button"
                onClick={() => setModelOpen((v) => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-resonance-text-secondary hover:text-resonance-text-primary hover:bg-resonance-bg-hover transition-all"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-resonance-accent" />
                {model.name}
                <ChevronDown size={12} />
              </button>
              {modelOpen && (
                <div className="absolute bottom-full mb-2 left-0 w-56 rounded-xl border border-resonance-border bg-resonance-bg-elevated shadow-xl p-1 z-30 animate-scale-in">
                  {MODELS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      disabled={m.disabled}
                      onClick={() => {
                        setModel(m)
                        setModelOpen(false)
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] transition-colors ${
                        m.disabled
                          ? 'text-resonance-text-muted cursor-not-allowed'
                          : 'text-resonance-text-primary hover:bg-resonance-bg-hover'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {m.id === model.id && <span className="w-1.5 h-1.5 rounded-full bg-resonance-accent" />}
                        {m.name}
                      </span>
                      {m.badge && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-resonance-bg-tertiary text-resonance-text-muted">
                          {m.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setUseDesignSystem((v) => !v)}
              title={useDesignSystem ? 'Constrain to the Resonance block library' : 'General architecture advice'}
              className="flex items-center gap-2 text-xs font-medium text-resonance-text-secondary hover:text-resonance-text-primary transition-colors"
            >
              <Layers size={13} />
              <span className="hidden md:inline">Use Design System</span>
              <span
                className={`relative w-8 h-[18px] rounded-full transition-colors ${
                  useDesignSystem ? 'bg-resonance-accent' : 'bg-resonance-bg-hover border border-resonance-border'
                }`}
              >
                <span
                  className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform ${
                    useDesignSystem ? 'translate-x-[14px]' : 'translate-x-0'
                  }`}
                />
              </span>
            </button>

            {isStreaming ? (
              <button
                type="button"
                onClick={stopStreaming}
                title="Stop generating"
                className="w-9 h-9 rounded-xl bg-resonance-bg-tertiary border border-resonance-border flex items-center justify-center text-resonance-text-primary hover:bg-resonance-bg-hover transition-all active:scale-95"
              >
                <Square size={12} fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={!value.trim()}
                title="Send (Enter)"
                className="w-9 h-9 rounded-xl bg-resonance-accent text-resonance-neutral flex items-center justify-center hover:bg-resonance-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
              >
                <ArrowUp size={17} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
