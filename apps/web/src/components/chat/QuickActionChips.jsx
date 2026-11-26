import React from 'react'
import { BookOpen, DollarSign, Scale, Search, ShieldAlert, Sparkles, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useChatStore } from '@/stores/chatStore'

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
      window.dispatchEvent(new CustomEvent('resonance:chat-prefill', { detail: prompt }))
    } else {
      sendMessage(prompt)
    }
  }

  return (
    <div className={`flex flex-wrap gap-2 ${variant === 'landing' ? 'justify-center' : ''}`}>
      {CHIPS[variant].map(({ icon: Icon, label, prompt }) => (
        <Button
          key={label}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onClick(prompt)}
          className="gap-1.5 rounded-full text-[13px] font-normal text-muted-foreground hover:text-foreground"
        >
          <Icon size={13} className="text-primary" />
          {label}
        </Button>
      ))}
    </div>
  )
}
