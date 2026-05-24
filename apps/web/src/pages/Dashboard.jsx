import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Search,
  MoreVertical,
  GitBranch,
  Play,
  Clock,
  Folder,
  Trash2,
  Copy,
  Grid3X3,
  List,
  Edit3,
  Eye,
  Loader2,
  AlertCircle,
  Github,
  Undo2,
  Pencil,
  Check,
  X,
} from 'lucide-react'
import { useDesignStore } from '@/stores/designStore'
import { useAuthStore } from '@/stores/authStore'
import { useToast } from '@/components/ui/Toast'
import { useDebounce } from '@/hooks/useDebounce'
import { animations } from '@/lib/anime'
import { formatDate } from '@/lib/dateUtils'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Dropdown } from '@/components/ui/Dropdown'
import { GitHubImportModal } from '@/components/canvas/GitHubImportModal'

export const Dashboard = () => {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { 
    designs, 
    loadDesigns, 
    deleteDesign, 
    createDesign, 
    duplicateDesign,
    updateDesign,
    restoreDesign,
    clearLastDeleted,
    isLoading, 
    error, 
    clearError 
  } = useDesignStore()
  const { user } = useAuthStore()
  
  const [viewMode, setViewMode] = useState('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 300)
  const [filterStatus, setFilterStatus] = useState('all')
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [designToDelete, setDesignToDelete] = useState(null)
  const [newDesignModal, setNewDesignModal] = useState(false)
  const [newDesignName, setNewDesignName] = useState('')
  const [newDesignRepo, setNewDesignRepo] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [isDuplicating, setIsDuplicating] = useState(null)

  const headerRef = useRef(null)
  const statsRef = useRef(null)
  const designsRef = useRef(null)

  useEffect(() => {
    loadDesigns().catch(() => {})
  }, [loadDesigns])

  useEffect(() => {
    if (headerRef.current) animations.fadeInUp(headerRef.current, 0)
    if (statsRef.current) animations.staggerFadeIn(statsRef.current.children, 100)
    if (designsRef.current) animations.staggerFadeIn(designsRef.current.children, 80)
  }, [designs.length])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault()
        setNewDesignModal(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const filteredDesigns = designs.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                         d.description?.toLowerCase().includes(debouncedSearch.toLowerCase())
    const matchesFilter = filterStatus === 'all' || d.status === filterStatus
    return matchesSearch && matchesFilter
  })

  const stats = [
    { label: 'Total Designs', value: designs.length, icon: Folder, color: 'text-resonance-accent' },
    { label: 'Active', value: designs.filter(d => d.status === 'active').length, icon: Play, color: 'text-green-500' },
    { label: 'Simulations', value: designs.reduce((acc, d) => acc + (d.simulations || 0), 0), icon: Clock, color: 'text-amber-500' },
    { label: 'Connected Repos', value: designs.filter(d => d.repoUrl).length, icon: GitBranch, color: 'text-blue-500' },
  ]

  const handleCreateDesign = async () => {
    if (!newDesignName.trim()) return
    setIsCreating(true)
    try {
      const designData = { 
        name: newDesignName, 
        description: '',
        repoUrl: newDesignRepo || undefined,
      }
      const design = await createDesign(designData)
      setNewDesignModal(false)
      setNewDesignName('')
      setNewDesignRepo('')
      addToast(`Created "${design.name}"`, 'success')
      navigate(`/design/${design.id}`)
    } catch (err) {
      addToast('Failed to create design', 'error')
    } finally {
      setIsCreating(false)
    }
  }

    const handleGitHubImport = async (importData) => {
    try {
      const design = await createDesign({
        name: importData.repo.name,
        description: `Imported from ${importData.repo.fullName} (${importData.branch})`,
        repoUrl: importData.repo.url,
        repoBranch: importData.branch,
      })

      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      const response = await fetch(`${API_BASE}/analyze/analyze-and-save/${design.id}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: importData.files, // Key: send file contents to AI
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Analysis failed' }))
        throw new Error(error.error || 'Failed to generate architecture')
      }

      const result = await response.json()
      addToast(`AI: ${result.metadata?.description || 'Architecture generated'}`, 'success')

      setShowImportModal(false)
      navigate(`/design/${design.id}`)
    } catch (err) {
      addToast(err.message || 'Failed to import from GitHub', 'error')
    }
  }

  const handleDelete = async () => {
    if (!designToDelete) return
    const name = designToDelete.name
    try {
      await deleteDesign(designToDelete.id)
      setDeleteModalOpen(false)
      setDesignToDelete(null)
      
      addToast(
        <span className="flex items-center gap-2">
          Deleted "{name}"
          <button
            onClick={handleUndoDelete}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 transition-colors text-xs font-medium"
          >
            <Undo2 size={12} />
            Undo
          </button>
        </span>,
        'warning',
        5000
      )
      
      setTimeout(() => clearLastDeleted(), 5000)
    } catch (err) {
      addToast('Failed to delete design', 'error')
    }
  }

  const handleUndoDelete = async () => {
    try {
      await restoreDesign()
      addToast('Design restored', 'success')
    } catch (err) {
      addToast('Failed to restore', 'error')
    }
  }

  const handleDuplicate = async (design) => {
    setIsDuplicating(design.id)
    try {
      const duplicate = await duplicateDesign(design.id)
      addToast(`Duplicated "${design.name}"`, 'success')
    } catch (err) {
      addToast('Failed to duplicate design', 'error')
    } finally {
      setIsDuplicating(null)
    }
  }

  const startEditing = (design, e) => {
    e.stopPropagation()
    setEditingId(design.id)
    setEditName(design.name)
  }

  const saveEdit = async (design) => {
    if (!editName.trim() || editName === design.name) {
      setEditingId(null)
      return
    }
    try {
      await updateDesign(design.id, { name: editName })
      addToast('Design renamed', 'success')
    } catch (err) {
      addToast('Failed to rename', 'error')
    }
    setEditingId(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
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
    { 
      label: isDuplicating === design.id ? 'Duplicating...' : 'Duplicate', 
      icon: isDuplicating === design.id ? Loader2 : Copy, 
      onClick: () => handleDuplicate(design) 
    },
    { label: 'Delete', icon: Trash2, danger: true, onClick: () => { setDesignToDelete(design); setDeleteModalOpen(true) } },
  ]

  if (isLoading && designs.length === 0) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-resonance-bg-tertiary rounded-lg animate-pulse" />
            <div className="h-4 w-64 bg-resonance-bg-tertiary rounded-lg animate-pulse" />
          </div>
          <div className="h-10 w-32 bg-resonance-bg-tertiary rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="p-4">
              <div className="h-5 w-5 bg-resonance-bg-tertiary rounded animate-pulse mb-2" />
              <div className="h-8 w-16 bg-resonance-bg-tertiary rounded animate-pulse mb-1" />
              <div className="h-4 w-24 bg-resonance-bg-tertiary rounded animate-pulse" />
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="p-5 h-[200px]">
              <div className="h-full flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-resonance-bg-tertiary rounded-lg animate-pulse" />
                  <div className="h-5 w-32 bg-resonance-bg-tertiary rounded animate-pulse" />
                </div>
                <div className="h-4 w-full bg-resonance-bg-tertiary rounded animate-pulse" />
                <div className="h-4 w-2/3 bg-resonance-bg-tertiary rounded animate-pulse" />
                <div className="mt-auto flex justify-between">
                  <div className="h-5 w-16 bg-resonance-bg-tertiary rounded animate-pulse" />
                  <div className="h-4 w-20 bg-resonance-bg-tertiary rounded animate-pulse" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-400">
          <AlertCircle size={16} />
          <span className="text-sm">{error}</span>
          <button onClick={clearError} className="ml-auto text-xs hover:text-red-300">Dismiss</button>
        </div>
      )}

      <div ref={headerRef} className="mb-8" style={{ opacity: 0 }}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-resonance-text-primary">Overview</h1>
            <p className="text-resonance-text-secondary">All your system designs and simulations</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              icon={Github}
              onClick={() => setShowImportModal(true)}
            >
              Import from GitHub
            </Button>
            <Button
              icon={Plus}
              onClick={() => setNewDesignModal(true)}
            >
              Create Design
            </Button>
          </div>
        </div>
      </div>

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

      {filteredDesigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-resonance-bg-tertiary flex items-center justify-center mb-4">
            <Folder size={32} className="text-resonance-text-muted" />
          </div>
          <h3 className="text-lg font-semibold text-resonance-text-primary mb-1">
            {searchQuery ? 'No designs match your search' : 'No designs yet'}
          </h3>
          <p className="text-resonance-text-secondary mb-4">
            {searchQuery ? 'Try a different search term' : 'Create your first system design or import from GitHub'}
          </p>
          {!searchQuery && (
            <div className="flex items-center gap-2">
              <Button variant="secondary" icon={Github} onClick={() => setShowImportModal(true)}>
                Import from GitHub
              </Button>
              <Button icon={Plus} onClick={() => setNewDesignModal(true)}>
                Create Design
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div
          ref={designsRef}
          className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}
        >
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
            <span className="text-xs text-resonance-text-muted mt-1">Ctrl+N</span>
          </button>

          {filteredDesigns.map((design) => (
            <div
              key={design.id}
              className={`group relative overflow-visible rounded-xl border border-resonance-border bg-resonance-bg-secondary hover:border-resonance-accent/30 hover:shadow-lg hover:shadow-resonance-accent/5 transition-all duration-200 ${viewMode === 'list' ? 'flex items-center gap-4 p-4' : 'p-5'}`}
              style={{ opacity: 0 }}
            >
              <div className={`absolute top-0 left-0 w-1 h-full ${
                design.status === 'active' ? 'bg-green-500' : 'bg-resonance-text-muted'
              }`} />

              <div 
                className={viewMode === 'list' ? 'flex-1 flex items-center gap-4 min-w-0' : ''}
                onClick={() => navigate(`/design/${design.id}`)}
              >
                <div className={viewMode === 'list' ? 'flex-1 flex items-center gap-4 min-w-0' : ''}>
                  <div className={`${viewMode === 'list' ? '' : 'flex items-start justify-between mb-3'}`}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        design.status === 'active' ? 'bg-green-500/10' : 'bg-resonance-bg-tertiary'
                      }`}>
                        {design.repoUrl ? (
                          <Github size={20} className={design.status === 'active' ? 'text-green-500' : 'text-resonance-text-muted'} />
                        ) : (
                          <GitBranch size={20} className={design.status === 'active' ? 'text-green-500' : 'text-resonance-text-muted'} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        {editingId === design.id ? (
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEdit(design)
                                if (e.key === 'Escape') cancelEdit()
                              }}
                              className="w-full px-2 py-1 bg-resonance-bg-tertiary border border-resonance-border rounded text-sm text-resonance-text-primary focus:outline-none focus:ring-2 focus:ring-resonance-accent/30"
                              autoFocus
                              onBlur={() => saveEdit(design)}
                            />
                            <button onClick={(e) => { e.stopPropagation(); saveEdit(design) }} className="p-1 rounded hover:bg-green-500/10 text-green-500">
                              <Check size={14} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); cancelEdit() }} className="p-1 rounded hover:bg-red-500/10 text-red-500">
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <h3 
                              className="font-semibold text-resonance-text-primary group-hover:text-resonance-accent transition-colors truncate cursor-pointer"
                              onDoubleClick={(e) => startEditing(design, e)}
                              title="Double-click to rename"
                            >
                              {design.name}
                            </h3>
                            <button
                              onClick={(e) => startEditing(design, e)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-resonance-bg-hover transition-all"
                            >
                              <Pencil size={12} className="text-resonance-text-muted" />
                            </button>
                          </div>
                        )}
                        {viewMode === 'list' && (
                          <p className="text-sm text-resonance-text-muted truncate">{design.description}</p>
                        )}
                      </div>
                    </div>
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
                            {design.blocks || 0} blocks
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
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {getStatusBadge(design.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-resonance-text-muted flex-shrink-0">
                        <span>{design.blocks || 0} blocks</span>
                        <span>{design.simulations || 0} simulations</span>
                        <span>{formatDate(design.updatedAt)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className={`flex items-center flex-shrink-0 ${viewMode === 'list' ? '' : 'absolute top-4 right-4'}`}>
                <Dropdown
                  trigger={
                    <button
                      className="p-1.5 rounded-lg hover:bg-resonance-bg-hover transition-colors"
                    >
                      <MoreVertical size={16} className="text-resonance-text-muted" />
                    </button>
                  }
                  items={getDesignDropdownItems(design)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={newDesignModal}
        onClose={() => { setNewDesignModal(false); setNewDesignName(''); setNewDesignRepo('') }}
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
            <div className="relative">
              <Github size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-resonance-text-muted" />
              <input
                type="text"
                placeholder="https://github.com/username/repo"
                value={newDesignRepo}
                onChange={(e) => setNewDesignRepo(e.target.value)}
                className="input-field pl-9"
              />
            </div>
            <p className="mt-1 text-xs text-resonance-text-muted">
              Connect a repo to auto-generate your architecture (Phase 2)
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => { setNewDesignModal(false); setNewDesignName(''); setNewDesignRepo('') }}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateDesign} 
              disabled={!newDesignName.trim() || isCreating}
              icon={isCreating ? Loader2 : null}
            >
              {isCreating ? 'Creating...' : 'Create Design'}
            </Button>
          </div>
        </div>
      </Modal>

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

      <GitHubImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleGitHubImport}
      />
    </div>
  )
}