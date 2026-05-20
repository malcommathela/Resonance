import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  GitBranch,
  Play,
  Clock,
  Folder,
  Trash2,
  Copy,
  ExternalLink,
  Grid3X3,
  List,
  Edit3,
  Eye,
} from 'lucide-react'
import { useDesignStore } from '@/stores/designStore'
import { useAuthStore } from '@/stores/authStore'
import { useDebounce } from '@/hooks/useDebounce'
import { animations } from '@/lib/anime'
import { formatDate } from '@/lib/dateUtils'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Dropdown } from '@/components/ui/Dropdown'

export const Dashboard = () => {
  const navigate = useNavigate()
  const { designs, deleteDesign, createDesign } = useDesignStore()
  const { user } = useAuthStore()
  const [viewMode, setViewMode] = useState('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 300)
  const [filterStatus, setFilterStatus] = useState('all')
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [designToDelete, setDesignToDelete] = useState(null)
  const [newDesignModal, setNewDesignModal] = useState(false)
  const [newDesignName, setNewDesignName] = useState('')

  const headerRef = useRef(null)
  const statsRef = useRef(null)
  const designsRef = useRef(null)

  useEffect(() => {
    if (headerRef.current) animations.fadeInUp(headerRef.current, 0)
    if (statsRef.current) animations.staggerFadeIn(statsRef.current.children, 100)
    if (designsRef.current) animations.staggerFadeIn(designsRef.current.children, 80)
  }, [designs.length])

  const filteredDesigns = designs.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                         d.description?.toLowerCase().includes(debouncedSearch.toLowerCase())
    const matchesFilter = filterStatus === 'all' || d.status === filterStatus
    return matchesSearch && matchesFilter
  })

  const stats = [
    { label: 'Total Designs', value: designs.length, icon: Folder, color: 'text-resonance-accent' },
    { label: 'Active', value: designs.filter(d => d.status === 'active').length, icon: Play, color: 'text-green-500' },
    { label: 'Simulations', value: designs.reduce((acc, d) => acc + d.simulations, 0), icon: Clock, color: 'text-amber-500' },
    { label: 'Team Members', value: 1, icon: GitBranch, color: 'text-blue-500' },
  ]

  const handleCreateDesign = () => {
    if (!newDesignName.trim()) return
    const design = createDesign({ name: newDesignName, description: '' })
    setNewDesignModal(false)
    setNewDesignName('')
    navigate(`/design/${design.id}`)
  }

  const handleDelete = () => {
    if (designToDelete) {
      deleteDesign(designToDelete.id)
      setDeleteModalOpen(false)
      setDesignToDelete(null)
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

  const getDesignDropdownItems = (design) => [
    { label: 'Open in Canvas', icon: Edit3, onClick: () => navigate(`/design/${design.id}`) },
    { label: 'View Details', icon: Eye, onClick: () => navigate(`/designs/${design.id}`) },
    { label: 'Duplicate', icon: Copy, onClick: () => {} },
    { label: 'Delete', icon: Trash2, danger: true, onClick: () => { setDesignToDelete(design); setDeleteModalOpen(true) } },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div ref={headerRef} className="mb-8" style={{ opacity: 0 }}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-resonance-text-primary">Overview</h1>
            <p className="text-resonance-text-secondary">All your system designs and simulations</p>
          </div>
          <Button
            icon={Plus}
            onClick={() => setNewDesignModal(true)}
          >
            Create Design
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div ref={statsRef} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => {
          const Icon = stat.icon
          return (
            <Card key={i} className="p-4" style={{ opacity: 0 }}>
              <div className="flex items-center justify-between mb-2">
                <Icon size={20} className={stat.color} />
              </div>
              <p className="text-2xl font-bold text-resonance-text-primary">{stat.value}</p>
              <p className="text-sm text-resonance-text-muted">{stat.label}</p>
            </Card>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-resonance-text-muted" />
            <input
              type="text"
              placeholder="Search designs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 pl-9 pr-4 py-2 bg-resonance-bg-secondary border border-resonance-border rounded-lg text-sm text-resonance-text-primary placeholder-resonance-text-muted focus:outline-none focus:ring-2 focus:ring-resonance-accent/30 focus:border-resonance-accent transition-all"
            />
          </div>
          <div className="flex items-center gap-1 bg-resonance-bg-secondary border border-resonance-border rounded-lg p-1">
            {['all', 'active', 'draft'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1 rounded-md text-sm font-medium capitalize transition-all ${
                  filterStatus === status
                    ? 'bg-resonance-accent text-white'
                    : 'text-resonance-text-secondary hover:text-resonance-text-primary'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-resonance-bg-hover text-resonance-accent' : 'text-resonance-text-muted hover:text-resonance-text-secondary'}`}
          >
            <Grid3X3 size={18} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-resonance-bg-hover text-resonance-accent' : 'text-resonance-text-muted hover:text-resonance-text-secondary'}`}
          >
            <List size={18} />
          </button>
        </div>
      </div>

      {/* Designs Grid/List */}
      {filteredDesigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-resonance-bg-tertiary flex items-center justify-center mb-4">
            <Folder size={32} className="text-resonance-text-muted" />
          </div>
          <h3 className="text-lg font-semibold text-resonance-text-primary mb-1">No designs yet</h3>
          <p className="text-resonance-text-secondary mb-4">Create your first system design to get started</p>
          <Button icon={Plus} onClick={() => setNewDesignModal(true)}>
            Create Design
          </Button>
        </div>
      ) : (
        <div
          ref={designsRef}
          className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}
        >
          {/* Create New Card */}
          <button
            onClick={() => setNewDesignModal(true)}
            className="group flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-resonance-border hover:border-resonance-accent/50 hover:bg-resonance-accent/5 transition-all duration-200 min-h-[200px]"
          >
            <div className="w-12 h-12 rounded-xl bg-resonance-bg-tertiary group-hover:bg-resonance-accent/10 flex items-center justify-center mb-3 transition-colors">
              <Plus size={24} className="text-resonance-text-muted group-hover:text-resonance-accent transition-colors" />
            </div>
            <span className="text-sm font-medium text-resonance-text-secondary group-hover:text-resonance-accent transition-colors">
              Create new design
            </span>
          </button>

          {filteredDesigns.map((design) => (
            <Card
              key={design.id}
              className={`group relative overflow-hidden cursor-pointer ${viewMode === 'list' ? 'flex items-center gap-4 p-4' : 'p-5'}`}
              onClick={() => navigate(`/design/${design.id}`)}
              style={{ opacity: 0 }}
            >
              {/* Status indicator */}
              <div className={`absolute top-0 left-0 w-1 h-full ${
                design.status === 'active' ? 'bg-green-500' : 'bg-resonance-text-muted'
              }`} />

              <div className={viewMode === 'list' ? 'flex-1 flex items-center gap-4' : ''}>
                <div className={`${viewMode === 'list' ? '' : 'flex items-start justify-between mb-3'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      design.status === 'active' ? 'bg-green-500/10' : 'bg-resonance-bg-tertiary'
                    }`}>
                      <GitBranch size={20} className={design.status === 'active' ? 'text-green-500' : 'text-resonance-text-muted'} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-resonance-text-primary group-hover:text-resonance-accent transition-colors">
                        {design.name}
                      </h3>
                      {viewMode === 'list' && (
                        <p className="text-sm text-resonance-text-muted">{design.description}</p>
                      )}
                    </div>
                  </div>
                  {viewMode !== 'list' && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Dropdown
                        trigger={
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 rounded-lg hover:bg-resonance-bg-hover transition-colors"
                          >
                            <MoreVertical size={14} className="text-resonance-text-muted" />
                          </button>
                        }
                        items={getDesignDropdownItems(design)}
                      />
                    </div>
                  )}
                </div>

                {viewMode !== 'list' && (
                  <>
                    <p className="text-sm text-resonance-text-secondary mb-4 line-clamp-2">
                      {design.description || 'No description'}
                    </p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(design.status)}
                        <span className="text-xs text-resonance-text-muted">
                          {design.blocks} blocks
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-resonance-text-muted">
                        <Clock size={12} />
                        {formatDate(design.updatedAt)}
                      </div>
                    </div>
                  </>
                )}

                {viewMode === 'list' && (
                  <>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(design.status)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-resonance-text-muted">
                      <span>{design.blocks} blocks</span>
                      <span>{design.simulations} simulations</span>
                      <span>{formatDate(design.updatedAt)}</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Dropdown
                        trigger={
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 rounded-lg hover:bg-resonance-bg-hover transition-colors"
                          >
                            <MoreVertical size={14} className="text-resonance-text-muted" />
                          </button>
                        }
                        items={getDesignDropdownItems(design)}
                      />
                    </div>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* New Design Modal */}
      <Modal
        isOpen={newDesignModal}
        onClose={() => { setNewDesignModal(false); setNewDesignName('') }}
        title="Create New Design"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-resonance-text-secondary mb-1.5">
              Design Name *
            </label>
            <input
              type="text"
              placeholder="e.g., E-Commerce Platform"
              value={newDesignName}
              onChange={(e) => setNewDesignName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateDesign()}
              className="input-field"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-resonance-text-secondary mb-1.5">
              GitHub Repository (optional)
            </label>
            <input
              type="text"
              placeholder="https://github.com/username/repo"
              className="input-field"
              disabled
            />
            <p className="mt-1 text-xs text-resonance-text-muted">GitHub integration coming in Phase 2</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => { setNewDesignModal(false); setNewDesignName('') }}>
              Cancel
            </Button>
            <Button onClick={handleCreateDesign} disabled={!newDesignName.trim()}>
              Create Design
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setDesignToDelete(null) }}
        title="Delete Design"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-resonance-text-secondary">
            Are you sure you want to delete <strong className="text-resonance-text-primary">{designToDelete?.name}</strong>?
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => { setDeleteModalOpen(false); setDesignToDelete(null) }}>
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
