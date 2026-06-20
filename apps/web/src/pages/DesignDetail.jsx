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
  Loader2,
} from 'lucide-react'
import { useDesignStore } from '@/stores/designStore'
import { useToast } from '@/components/ui/Toast'
import { animations } from '@/lib/anime'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'

const ACCENT_PRESETS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7'
]

export const DesignDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()
  
  // FIXED: Select individual store fields for reactivity
  const currentDesign = useDesignStore(state => state.currentDesign)
  const isLoading = useDesignStore(state => state.isLoading)
  const loadDesign = useDesignStore(state => state.loadDesign)
  const deleteDesign = useDesignStore(state => state.deleteDesign)
  const updateDesign = useDesignStore(state => state.updateDesign)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [localDesign, setLocalDesign] = useState(null)

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editAccent, setEditAccent] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const containerRef = useRef(null)

  // FIXED: Load design and keep local state in sync
  useEffect(() => {
    if (id) {
      loadDesign(id).then(d => {
        if (d) setLocalDesign(d)
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

  // FIXED: Sync local state when store updates
  useEffect(() => {
    if (currentDesign && currentDesign.id === id) {
      setLocalDesign(currentDesign)
    }
  }, [currentDesign, id])

  // Use loaded design from store or local state
  const design = currentDesign?.id === id ? currentDesign : localDesign

  // Sync edit form when design loads
  useEffect(() => {
    if (design) {
      setEditName(design.name)
      setEditDescription(design.description || '')
      setEditAccent(design.accentColor || '#6366f1')
    }
  }, [design?.id])

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

  // FIXED: Compute accent and block count with fallbacks
  const accent = design.accentColor || '#6366f1'
  const blockCount = design.blocks ?? design.nodeCount ?? design.nodes?.length ?? 0

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

  // FIXED: Save and reload to ensure state sync
    const handleSaveEdit = async () => {
    if (!editName.trim()) return
    setIsSaving(true)
    try {
      await updateDesign(design.id, {
        name: editName.trim(),
        description: editDescription.trim(),
        accentColor: editAccent
      })
      
      setShowEditModal(false)
      addToast('Design updated successfully', 'success')
    } catch (err) {
      addToast(err.message || 'Failed to update design', 'error')
    } finally {
      setIsSaving(false)
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
          <div className="flex-1 min-w-0">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-1 text-sm text-resonance-text-muted hover:text-resonance-text-secondary transition-colors mb-3"
            >
              <ArrowLeft size={16} />
              Back to Dashboard
            </button>
            <div className="flex items-center gap-3 mb-2">
              <div 
                className="w-4 h-4 rounded-full shrink-0" 
                style={{ backgroundColor: accent }} 
              />
              <h1 className="text-2xl font-bold text-resonance-text-primary">{design.name}</h1>
              {getStatusBadge(design.status)}
            </div>
            <p className="text-resonance-text-secondary">{design.description || 'No description'}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              icon={Edit3}
              onClick={() => setShowEditModal(true)}
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
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${accent}15` }}
              >
                <Blocks size={20} style={{ color: accent }} />
              </div>
              <div>
                <p className="text-2xl font-bold text-resonance-text-primary">{blockCount}</p>
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
                    className="text-sm hover:underline flex items-center gap-1"
                    style={{ color: accent }}
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

      {/* Edit Design Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Design Details"
      >
        <div className="space-y-4">
          <Input
            label="Design Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            autoFocus
          />
          <div className="space-y-2">
            <label className="text-sm font-medium text-resonance-text-primary">Description</label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Add a description..."
              rows={3}
              className="w-full px-3 py-2 bg-resonance-bg-tertiary border border-resonance-border rounded-lg text-sm text-resonance-text-primary placeholder-resonance-text-muted focus:outline-none focus:ring-2 focus:ring-resonance-accent/30 focus:border-resonance-accent transition-all resize-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-resonance-text-primary">Accent Color</label>
            <div className="flex flex-wrap gap-2">
              {ACCENT_PRESETS.map((color) => (
                <button
                  key={color}
                  onClick={() => setEditAccent(color)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    editAccent === color ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={!editName.trim() || isSaving}>
              {isSaving ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

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