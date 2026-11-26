import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Database, DoorOpen, Globe, HardDrive, Mail, Network, Play, Plug,
  Radio, Server, Shuffle, Trash2, X, Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { useChatStore } from '@/stores/chatStore'
import { materializeGeneratedDesign } from '@/services/chatApi'

const NODE_ICONS = {
  Globe, Server, Database, Zap, Mail, Shuffle, DoorOpen, Radio, HardDrive, Plug,
}

export const GenerationCard = ({ generation, messageId }) => {
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const { addToast } = useToast()
  const discardGeneration = useChatStore((s) => s.discardGeneration)

  const open = (path) => {
    if (generation.designId) {
      navigate(path(generation.designId))
      return
    }
    setBusy(true)
    materializeGeneratedDesign(generation)
      .then((design) => navigate(path(design.id)))
      .catch((err) => {
        addToast(err?.message || 'Could not save the generated design', 'error')
        setBusy(false)
      })
  }

  return (
    <Card hover={false} className="mt-3 max-w-xl animate-scale-in overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3.5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Network size={15} className="text-primary" />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
            Generated Design
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => discardGeneration(messageId)}
          title="Discard"
          className="h-7 w-7"
        >
          <X size={14} />
        </Button>
      </div>

      <div className="px-4 pt-1.5">
        <h4 className="text-[15px] font-semibold text-foreground">{generation.name}</h4>
        <p className="mt-0.5 text-xs text-muted-foreground">{generation.description}</p>
      </div>

      <div className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-muted-foreground">
        <span>
          <b className="tabular-nums text-foreground">{generation.nodes.length}</b> nodes
        </span>
        <span className="h-1 w-1 rounded-full bg-border" />
        <span>
          <b className="tabular-nums text-foreground">{generation.edges.length}</b> edges
        </span>
        <span className="h-1 w-1 rounded-full bg-border" />
        <span>
          ~<b className="tabular-nums text-foreground">
            ${generation.estimatedMonthlyCost?.toLocaleString()}
          </b>{' '}
          /month
        </span>
      </div>

      <div className="mx-4 mb-3 rounded-xl border bg-muted p-3">
        <div className="flex flex-wrap gap-1.5">
          {generation.nodes.map((n) => {
            const Icon = NODE_ICONS[n.data.icon] || Server
            return (
              <span
                key={n.id}
                className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground"
              >
                <Icon size={12} style={{ color: n.data.color }} />
                {n.data.label}
              </span>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
        <Button
          size="sm"
          loading={busy}
          onClick={() => open((id) => `/design/${id}`)}
          className="text-xs"
        >
          Open in Canvas Editor
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => open((id) => `/designs/${id}`)}
          className="gap-1.5 text-xs"
        >
          {!busy && <Play size={12} />}
          Run Sim
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => discardGeneration(messageId)}
          className="gap-1.5 text-xs"
        >
          {!busy && <Trash2 size={12} />}
          Discard
        </Button>
      </div>
    </Card>
  )
}
