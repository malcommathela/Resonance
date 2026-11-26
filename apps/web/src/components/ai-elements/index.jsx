import { useEffect, useRef, useState } from 'react'
import {
  ArrowDown, ArrowUp, Brain, Check, ChevronDown, ChevronRight, Copy,
  Loader2, Network, Square, Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export const Chat = ({ children, className }) => {
  const ref = useRef(null)
  const stick = useRef(true)
  const [away, setAway] = useState(false)

  useEffect(() => {
    if (stick.current && ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [children])

  const onScroll = () => {
    const el = ref.current
    if (!el) return
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    setAway(!stick.current)
  }

  const toBottom = () => {
    const el = ref.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    stick.current = true
    setAway(false)
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={ref} onScroll={onScroll} className={cn('h-full overflow-y-auto', className)}>
        {children}
      </div>
      {away && (
        <Button
          type="button"
          size="icon"
          variant="secondary"
          onClick={toBottom}
          title="Jump to latest"
          className="absolute bottom-4 left-1/2 h-8 w-8 -translate-x-1/2 rounded-full border shadow-md"
        >
          <ArrowDown size={15} />
        </Button>
      )}
    </div>
  )
}

export const ChatContent = ({ children, className }) => (
  <div className={cn('mx-auto max-w-3xl space-y-6 px-4 py-6', className)}>{children}</div>
)

export const ChatEmptyState = ({ icon, title, description, children }) => (
  <div className="flex animate-fade-in flex-col items-center pb-12 pt-[min(18vh,9rem)] text-center">
    {icon && <div className="mb-5">{icon}</div>}
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
      Resonance workspace
    </p>
    <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
    <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
    {children && <div className="mt-6">{children}</div>}
  </div>
)

export const Message = ({ from = 'assistant', className, children }) => (
  <div
    className={cn(
      'group/message flex w-full animate-fade-in flex-col gap-2',
      from === 'user' ? 'items-end' : 'items-start',
      className
    )}
  >
    {children}
  </div>
)

export const MessageContent = ({ children, className }) => (
  <div className={cn('min-w-0 max-w-none', className)}>{children}</div>
)

export const MessageActions = ({ children, className }) => (
  <div
    className={cn(
      'flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover/message:opacity-100 focus-within:opacity-100',
      className
    )}
  >
    {children}
  </div>
)

export const MessageAction = ({ label, icon: Icon, active, className, ...props }) => (
  <Button
    type="button"
    variant="ghost"
    size="icon"
    title={label}
    className={cn('h-7 w-7', active && 'text-primary', className)}
    {...props}
  >
    <Icon size={14} />
  </Button>
)

export const Trace = ({ children, className }) => (
  <div className={cn('space-y-1 border-l border-border pl-3', className)}>{children}</div>
)

export const Reasoning = ({ text, streaming, label }) => {
  const [open, setOpen] = useState(false)
  const expanded = open || streaming

  return (
    <Trace>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        {streaming ? (
          <Loader2 size={13} className={cn('animate-spin', 'text-primary')} />
        ) : (
          <Brain size={13} className="text-primary" />
        )}
        <span>{streaming ? label || 'Thinking' : 'Thought process'}</span>
        <ChevronDown size={12} className={cn('transition-transform', expanded && 'rotate-180')} />
      </button>
      {expanded && text && (
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{text}</p>
      )}
    </Trace>
  )
}

export const Tool = ({ title, icon: Icon, status, children, className, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Trace className={cn('rounded-lg border bg-card p-2.5', className)}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 text-left text-xs"
      >
        {Icon && <Icon size={13} className="text-primary" />}
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">{title}</span>
        {status && (
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
            {status}
          </Badge>
        )}
        <ChevronDown size={12} className={cn('text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="pt-2">{children}</div>}
    </Trace>
  )
}

export const FileTree = ({ nodes }) => (
  <div className="space-y-1">
    {nodes.map((node) => (
      <div key={node.id} className="flex items-center gap-2 text-xs text-muted-foreground">
        <ChevronRight size={11} />
        <Network size={12} style={{ color: node.data?.color }} />
        <span className="truncate">{node.data?.label}</span>
      </div>
    ))}
  </div>
)

export const Plan = ({ steps }) => (
  <ol className="space-y-1.5">
    {steps.map((step) => (
      <li key={step.label} className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Check size={10} />
        </span>
        <span>{step.label}</span>
      </li>
    ))}
  </ol>
)

export const Confirmation = ({ onConfirm, label = 'Discard' }) => {
  const [pending, setPending] = useState(false)
  if (!pending) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setPending(true)}
        className="gap-1.5 text-xs"
      >
        <Trash2 size={12} />
        {label}
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted px-2 py-1.5 text-xs">
      <span className="text-muted-foreground">Discard this design?</span>
      <Button type="button" size="sm" variant="destructive" className="h-6 px-2 text-[11px]" onClick={onConfirm}>
        Confirm
      </Button>
      <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => setPending(false)}>
        Cancel
      </Button>
    </div>
  )
}

export const PromptInput = ({ children, className }) => (
  <div className={cn('rounded-2xl border bg-card text-card-foreground shadow-sm transition-colors focus-within:border-ring/60', className)}>
    {children}
  </div>
)

export const PromptInputToolbar = ({ children, className }) => (
  <div className={cn('flex items-center justify-between px-3 pb-2.5 pt-1', className)}>{children}</div>
)

export const PromptInputSubmit = ({ streaming, disabled, onSubmit, onStop }) =>
  streaming ? (
    <Button type="button" variant="secondary" size="icon" onClick={onStop} title="Stop generating" className="h-9 w-9 rounded-xl">
      <Square size={12} fill="currentColor" />
    </Button>
  ) : (
    <Button type="button" size="icon" onClick={onSubmit} disabled={disabled} title="Send (Enter)" className="h-9 w-9 rounded-xl">
      <ArrowUp size={17} strokeWidth={2.5} />
    </Button>
  )

export const MODELS = [
  { id: 'resonance-1', name: 'Resonance 1.0', disabled: false },
  { id: 'resonance-pro', name: 'Resonance Pro', badge: 'Soon', disabled: true },
]

export const ModelSelector = ({ value, onChange }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        {value.name}
        <ChevronDown className="h-3 w-3" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" side="top" className="w-56">
      {MODELS.map((model) => (
        <DropdownMenuItem key={model.id} disabled={model.disabled} onSelect={() => onChange(model)} className="justify-between">
          <span className="flex items-center gap-2">
            {model.id === value.id && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
            {model.name}
          </span>
          {model.badge && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">{model.badge}</span>
          )}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
)

export const ContextBadge = ({ name, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex min-w-0 items-center gap-1 rounded-md border bg-muted/50 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
  >
    <Network size={11} className="shrink-0 text-primary" />
    <span className="truncate">Discussing {name}</span>
  </button>
)

export const Suggestions = ({ children, className }) => (
  <div className={cn('flex flex-wrap gap-2', className)}>{children}</div>
)

export const Suggestion = ({ icon: Icon, children, ...props }) => (
  <Button type="button" variant="outline" size="sm" className="gap-1.5 rounded-full text-[13px] font-normal text-muted-foreground hover:text-foreground" {...props}>
    {Icon && <Icon size={13} className="text-primary" />}
    {children}
  </Button>
)

export const CodeBlock = ({ code, children }) => {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      return
    }
  }

  return (
    <div className="group/code relative mb-3 rounded-xl border bg-card">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={copy}
        title="Copy code"
        className="absolute right-2 top-2 h-7 w-7 opacity-100 transition-opacity sm:opacity-0 sm:group-hover/code:opacity-100 focus:opacity-100"
      >
        {copied ? <Check size={13} className="text-primary" /> : <Copy size={13} />}
      </Button>
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed text-foreground">{children}</pre>
    </div>
  )
}
