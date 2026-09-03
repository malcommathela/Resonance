import React from 'react'
import { BookOpen, DollarSign, Scale, Search, ShieldAlert, Sparkles, TrendingUp } from 'lucide-react'
import { useChatStore } from '@/stores/chatStore'

/*
 * variant="landing" — teaching chips under the hero composer; they prefill it.
 * variant="thread"  — empty-thread suggestions; they send immediately.
 * variant="design"  — design-aware follow-ups under assistant answers; send.
 */

const LANDING_CHIPS = [
  { icon: Sparkles, label: 'Design a real-time notification system', prompt: 'Design a real-time notification system' },
  { icon: Scale, label: 'Kafka vs RabbitMQ — which should I choose?', prompt: 'Kafka vs RabbitMQ — which should I choose?' },
  { icon: BookOpen, label: 'What is a circuit breaker pattern?', prompt: 'What is a circuit breaker pattern?' },
]

const THREAD_CHIPS = [
  { icon: Sparkles, label: 'Design a URL shortener', prompt: 'Design a URL shortener' },
  { icon: Scale, label: 'Kafka vs RabbitMQ', prompt: 'Kafka vs RabbitMQ — which should I choose?' },
  { icon: BookOpen, label: 'Explain consistent hashing', prompt: 'Explain consistent hashing and sharding' },
]

const DESIGN_CHIPS = [
  { icon: Search, label: 'Find Bottlenecks', prompt: 'What are the biggest bottlenecks in this design?' },
  { icon: TrendingUp, label: 'Suggest Improvements', prompt: 'How can I improve and scale this design?' },
  { icon: ShieldAlert, label: 'Check Risks', prompt: 'What are the main risks in this design?' },
  { icon: DollarSign, label: 'Estimate Cost', prompt: 'Estimate the monthly cost of this design.' },
]

const CHIPS = { landing: LANDING_CHIPS, thread: THREAD_CHIPS, design: DESIGN_CHIPS }

export const QuickActionChips = ({ variant = 'landing' }) => {
  const sendMessage = useChatStore((s) => s.sendMessage)

  const onClick = (prompt) => {
    if (variant === 'landing') {
      // Fill the hero composer so the user can edit before sending
      window.dispatchEvent(new CustomEvent('resonance:chat-prefill', { detail: prompt }))
    } else {
      sendMessage(prompt)
    }
  }

  return (
    <div className={`flex flex-wrap gap-2 ${variant === 'landing' ? 'justify-center' : ''}`}>
      {CHIPS[variant].map(({ icon: Icon, label, prompt }) => (
        <button
          key={label}
          type="button"
          onClick={() => onClick(prompt)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-resonance-border bg-resonance-bg-secondary text-[13px] text-resonance-text-secondary hover:text-resonance-text-primary hover:border-resonance-accent/40 hover:bg-resonance-bg-hover transition-all active:scale-95"
        >
          <Icon size={13} className="text-resonance-accent" />
          {label}
        </button>
      ))}
    </div>
  )
}
