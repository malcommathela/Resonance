import React, { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Edit3,
  Play,
  GitBranch,
  Clock,
  Blocks,
  Activity,
  ExternalLink,
  Calendar,
  Trash2,
} from 'lucide-react'
import { useDesignStore } from '@/stores/designStore'
import { useToast } from '@/components/ui/Toast'
import { animations } from '@/lib/anime'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'

export const DesignDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { loadDesign, currentDesign, deleteDesign, isLoading } = useDesignStore()
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [localDesign, setLocalDesign] = useState(null)

  const containerRef = useRef(null)

  useEffect(() => {
    if (id) {
      loadDesign(id).then(d => {
        setLocalDesign(d)
      }).catch(() => {
        navigate('/dashboard')
      })
    }
  }, [id, loadDesign, navigate])

  useEffect(() => {
    if (containerRef.current) {
      animations.fadeInUp(containerRef.current, 0)
    }
  }, [])

  // Use loaded design from store or local state
  const design = currentDesign || localDesign

  if (isLoading && !design) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="space-y-4">
          <div className="h-8 w-48 bg-resonance-bg-tertiary rounded-lg animate-pulse" />
          <div className="h-4 w-64 bg-resonance-bg-tertiary rounded-lg animate-pulse" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} className="p-4 h-24">
                <div className="h-full bg-resonance-bg-tertiary rounded animate-pulse" />
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!design) return null

  const handleDelete = async () => {
    try {
      await deleteDesign(design.id)
      setShowDeleteModal(false)
      addToast(`Deleted "${design.name}"`, 'warning')
      navigate('/dashboard')
    } catch (err) {
      addToast('Failed to delete design', 'error')
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active': return <Badge variant="success">Active</Badge>
      case 'draft': return <Badge variant="draft">Draft</Badge>
      case 'archived': return <Badge variant="default">Archived</Badge>
      default: return <Badge variant="default">{status}</Badge>
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div ref={containerRef} style={{ opacity: 0 }}>
        <div className="flex items-start justify-between mb-8">
          <div>
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-1 text-sm text-resonance-text-muted hover:text-resonance-text-secondary transition-colors mb-3"
            >
              <ArrowLeft size={16} />
              Back to Dashboard
            </button>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-resonance-text-primary">{design.name}</h1>
              {getStatusBadge(design.status)}
            </div>
            <p className="text-resonance-text-secondary">{design.description || 'No description'}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={Edit3}
              onClick={() => navigate(`/design/${design.id}`)}
            >
              Edit
            </Button>
            <Button
              size="sm"
              icon={Play}
              onClick={() => navigate(`/design/${design.id}`)}
            >
              Open Canvas
            </Button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="p-2 rounded-lg hover:bg-red-500/10 text-resonance-text-muted hover:text-red-500 transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-resonance-accent/10 flex items-center justify-center">
                <Blocks size={20} className="text-resonance-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold text-resonance-text-primary">{design.blocks || 0}</p>
                <p className="text-xs text-resonance-text-muted">Blocks</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Activity size={20} className="text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-resonance-text-primary">{design.simulations || 0}</p>
                <p className="text-xs text-resonance-text-muted">Simulations</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock size={20} className="text-amber-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-resonance-text-primary">
                  {new Date(design.updatedAt).toLocaleDateString()}
                </p>
                <p className="text-xs text-resonance-text-muted">Last Updated</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Calendar size={20} className="text-blue-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-resonance-text-primary">
                  {new Date(design.createdAt).toLocaleDateString()}
                </p>
                <p className="text-xs text-resonance-text-muted">Created</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-resonance-bg-tertiary flex items-center justify-center">
                <GitBranch size={20} className="text-resonance-text-muted" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-resonance-text-primary">GitHub Repository</h3>
                {design.repoUrl ? (
                  <a
                    href={design.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-resonance-accent hover:underline flex items-center gap-1"
                  >
                    {design.repoUrl}
                    <ExternalLink size={12} />
                  </a>
                ) : (
                  <p className="text-sm text-resonance-text-muted">No repository connected</p>
                )}
              </div>
            </div>
            <Button variant="secondary" size="sm" disabled>
              {design.repoUrl ? 'Sync' : 'Connect'}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-semibold text-resonance-text-primary mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {[
              { action: 'Design created', time: design.createdAt, icon: Blocks },
              { action: 'Last edited', time: design.updatedAt, icon: Edit3 },
            ].map((activity, i) => {
              const Icon = activity.icon
              return (
                <div key={i} className="flex items-center gap-3 py-2">
                  <div className="w-8 h-8 rounded-lg bg-resonance-bg-tertiary flex items-center justify-center">
                    <Icon size={14} className="text-resonance-text-muted" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-resonance-text-primary">{activity.action}</p>
                    <p className="text-xs text-resonance-text-muted">
                      {new Date(activity.time).toLocaleString()}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Design"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-resonance-text-secondary">
            Are you sure you want to delete <strong className="text-resonance-text-primary">{design.name}</strong>?
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}