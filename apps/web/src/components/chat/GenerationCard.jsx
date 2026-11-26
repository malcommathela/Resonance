import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Network } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import {
  Confirmation, FileTree, Plan, Tool,
} from '@/components/ai-elements'
import { useChatStore } from '@/stores/chatStore'
import { materializeGeneratedDesign } from '@/services/chatApi'

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

  const steps = [
    { label: `Define ${generation.nodes.length} components` },
    { label: `Wire ${generation.edges.length} connections` },
    { label: `Estimate ~$${generation.estimatedMonthlyCost?.toLocaleString()}/month` },
  ]

  return (
    <Tool
      title={`Generated design · ${generation.name}`}
      icon={Network}
      status="Complete"
      defaultOpen
      className="mt-3 max-w-xl animate-scale-in"
    >
      <div className="space-y-3">
        <p className="text-xs leading-relaxed text-muted-foreground">{generation.description}</p>

        <FileTree nodes={generation.nodes} />

        <Plan steps={steps} />

        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <Button size="sm" loading={busy} onClick={() => open((id) => `/design/${id}`)} className="text-xs">
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
          <Confirmation onConfirm={() => discardGeneration(messageId)} />
        </div>
      </div>
    </Tool>
  )
}
