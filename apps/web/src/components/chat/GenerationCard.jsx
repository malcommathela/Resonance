import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Database, DoorOpen, Globe, HardDrive, Mail, Network, Play, Plug,
  Radio, Server, Shuffle, Trash2, X, Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useChatStore } from '@/stores/chatStore'
import { materializeGeneratedDesign } from '@/services/chatApi'

const NODE_ICONS = {
  Globe, Server, Database, Zap, Mail, Shuffle, DoorOpen, Radio, HardDrive, Plug,
}

/*
 * Inline artifact card for AI-generated designs (v0/bolt.new pattern).
 * Live backend: the design is already durable (created in the generation
 * worker transaction) and the card payload carries its designId, so both
 * buttons navigate directly. Mock payloads have no designId — they fall
 * back to materializeGeneratedDesign() (create + save canvas, then navigate).
 */
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
    <div className="mt-3 rounded-2xl border border-resonance-border bg-resonance-bg-secondary overflow-hidden max-w-xl animate-scale-in">
      <div className="flex items-center justify-between px-4 pt-3.5">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-resonance-accent/15 flex items-center justify-center">
            <Network size={15} className="text-resonance-accent" />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-resonance-accent">
            Generated Design
          </span>
        </div>
        <button
          type="button"
          onClick={() => discardGeneration(messageId)}
          title="Discard"
          className="p-1.5 rounded-md text-resonance-text-muted hover:text-resonance-text-primary hover:bg-resonance-bg-hover transition-all"
        >
          <X size={14} />
        </button>
      </div>

      <div className="px-4 pt-1.5">
        <h4 className="text-[15px] font-semibold text-resonance-text-primary">{generation.name}</h4>
        <p className="text-xs text-resonance-text-secondary mt-0.5">{generation.description}</p>
      </div>

      <div className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-resonance-text-secondary">
        <span>
          <b className="text-resonance-text-primary tabular-nums">{generation.nodes.length}</b> nodes
        </span>
        <span className="w-1 h-1 rounded-full bg-resonance-border" />
        <span>
          <b className="text-resonance-text-primary tabular-nums">{generation.edges.length}</b> edges
        </span>
        <span className="w-1 h-1 rounded-full bg-resonance-border" />
        <span>
          ~<b className="text-resonance-text-primary tabular-nums">
            ${generation.estimatedMonthlyCost?.toLocaleString()}
          </b>{' '}
          /month
        </span>
      </div>

      <div className="mx-4 mb-3 rounded-xl bg-resonance-bg-tertiary border border-resonance-border p-3">
        <div className="flex flex-wrap gap-1.5">
          {generation.nodes.map((n) => {
            const Icon = NODE_ICONS[n.data.icon] || Server
            return (
              <span
                key={n.id}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-resonance-bg-elevated border border-resonance-border text-[11px] font-medium text-resonance-text-secondary"
              >
                <Icon size={12} style={{ color: n.data.color }} />
                {n.data.label}
              </span>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-resonance-border">
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
          className="text-xs gap-1.5"
        >
          {!busy && <Play size={12} />}
          Run Sim
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => discardGeneration(messageId)}
          className="text-xs gap-1.5"
        >
          {!busy && <Trash2 size={12} />}
          Discard
        </Button>
      </div>
    </div>
  )
}
