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
  Share2,
  MoreVertical,
  Trash2,
  Copy,
  ExternalLink,
  Calendar,
  User,
} from 'lucide-react'
import { useDesignStore } from '@/stores/designStore'
import { animations } from '@/lib/anime'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'

export const DesignDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getDesignById, deleteDesign } = useDesignStore()
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const design = getDesignById(id)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!design) {
      navigate('/dashboard')
      return
    }
    if (containerRef.current) {
      animations.fadeInUp(containerRef.current, 0)
    }
  }, [design, navigate])

  if (!design) return null

  const handleDelete = () => {
    deleteDesign(design.id)
    setShowDeleteModal(false)
    navigate('/dashboard')
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
        {/* Header */}
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

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-resonance-accent/10 flex items-center justify-center">
                <Blocks size={20} className="text-resonance-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold text-resonance-text-primary">{design.blocks}</p>
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
                <p className="text-2xl font-bold text-resonance-text-primary">{design.simulations}</p>
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

        {/* GitHub Integration */}
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

        {/* Recent Activity */}
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

      {/* Delete Confirmation */}
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
