import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { useDesignStore } from '@/stores/designStore'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { DesignCard, getRandomAccent } from '@/components/ui/DesignCard'
import { GitHubImportModal } from '@/components/canvas/GitHubImportModal'
import { 
  Loader2, Plus, Search, Github, LayoutGrid, List, Trash2, X, Layers,
  FolderOpen, GitBranch, Clock, Activity, Zap, FolderGit, FileCode
} from 'lucide-react'
import { api } from '@/services/api'

export const Dashboard = () => {
  const navigate = useNavigate()
  const { isSignedIn, isLoaded: authLoaded } = useAuth()

  const designs = useDesignStore(state => state.designs)
  const isLoading = useDesignStore(state => state.isLoading)
  const loadDesigns = useDesignStore(state => state.loadDesigns)
  const createDesign = useDesignStore(state => state.createDesign)
  const deleteDesign = useDesignStore(state => state.deleteDesign)
  const updateDesign = useDesignStore(state => state.updateDesign)

  const [showNewModal, setShowNewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [newDesignName, setNewDesignName] = useState('')
  const [newDesignDescription, setNewDesignDescription] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState('grid')
  const [selectedDesigns, setSelectedDesigns] = useState(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [toasts, setToasts] = useState([])
  const [activeFilter, setActiveFilter] = useState('all')

  // Edit state
  const [editingDesign, setEditingDesign] = useState(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editAccent, setEditAccent] = useState('')

  // Import loading state
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState('')

  useEffect(() => {
    if (authLoaded && isSignedIn) {
      loadDesigns()
    }
  }, [authLoaded, isSignedIn, loadDesigns])

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  // Overview stats
  const stats = useMemo(() => {
    const total = designs.length
    const active = designs.filter(d => d.status === 'active').length
    const withRepo = designs.filter(d => d.repoUrl).length
    const totalBlocks = designs.reduce((sum, d) => sum + (d.blocks || 0), 0)
    return { total, active, withRepo, totalBlocks }
  }, [designs])

  const handleCreateDesign = async () => {
    if (!newDesignName.trim()) return
    try {
      const design = await createDesign({ 
        name: newDesignName.trim(),
        description: newDesignDescription.trim(),
        accentColor: getRandomAccent()
      })
      setShowNewModal(false)
      setNewDesignName('')
      setNewDesignDescription('')
      addToast('Design created successfully', 'success')
      navigate(`/design/${design.id}`)
    } catch (err) {
      addToast(err.message || 'Failed to create design', 'error')
    }
  }

  const handleEditDesign = (design) => {
    setEditingDesign(design)
    setEditName(design.name)
    setEditDescription(design.description || '')
    setEditAccent(design.accentColor || '#6366f1')
    setShowEditModal(true)
  }

  const handleSaveEdit = async () => {
    if (!editingDesign || !editName.trim()) return
    try {
      await updateDesign(editingDesign.id, {
        name: editName.trim(),
        description: editDescription.trim(),
        accentColor: editAccent
      })
      setShowEditModal(false)
      setEditingDesign(null)
      addToast('Design updated successfully', 'success')
    } catch (err) {
      addToast(err.message || 'Failed to update design', 'error')
    }
  }

  const handleDuplicateDesign = async (design) => {
    try {
      await createDesign({
        name: `${design.name} (Copy)`,
        description: design.description,
        accentColor: design.accentColor || getRandomAccent(),
        repoUrl: design.repoUrl,
        repoBranch: design.repoBranch,
      })
      await loadDesigns()
      addToast('Design duplicated', 'success')
    } catch (err) {
      addToast(err.message || 'Failed to duplicate design', 'error')
    }
  }

  const handleGitHubImport = async (importData) => {
    setIsImporting(true)
    setImportProgress('Creating design...')

    try {
      const design = await createDesign({
        name: importData.repo.name,
        description: `Imported from ${importData.repo.fullName} (${importData.branch})`,
        repoUrl: importData.repo.url,
        repoBranch: importData.branch,
        accentColor: getRandomAccent(),
      })

      if (importData.preGenerated) {
        setImportProgress('Saving architecture...')

        await api.saveCanvas(design.id, {
          nodes: importData.preGenerated.nodes,
          edges: importData.preGenerated.edges,
        })

        await updateDesign(design.id, {
          blocks: importData.preGenerated.nodes?.length || 0
        })

        if (importData.preGenerated.metadata?.description) {
          await api.updateDesign(design.id, {
            description: `${design.description} | AI: ${importData.preGenerated.metadata.description}`,
          })
        }

        addToast(`AI: ${importData.preGenerated.metadata?.description || 'Architecture generated'}`, 'success')
      } else {
        setImportProgress('Analyzing codebase...')
        const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
        const token = await api.getAuthToken()
        const response = await fetch(`${API_BASE}/analyze/analyze-and-save/${design.id}`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ files: importData.files }),
        })

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Analysis failed' }))
          throw new Error(error.error || 'Failed to generate architecture')
        }

        const result = await response.json()

        if (result.nodes) {
          await updateDesign(design.id, {
            blocks: result.nodes.length || 0
          })
        }

        addToast(`AI: ${result.metadata?.description || 'Architecture generated'}`, 'success')
      }

      setImportProgress('Finalizing...')
      await new Promise(r => setTimeout(r, 1500))

      setShowImportModal(false)
      setIsImporting(false)
      await loadDesigns()
      navigate(`/design/${design.id}`)
    } catch (err) {
      setIsImporting(false)
      addToast(err.message || 'Failed to import from GitHub', 'error')
    }
  }

  const handleDeleteDesign = async (id) => {
    try {
      await deleteDesign(id)
      addToast('Design deleted', 'success')
    } catch (err) {
      addToast(err.message || 'Failed to delete design', 'error')
    }
  }

  const handleBulkDelete = async () => {
    try {
      await Promise.all(Array.from(selectedDesigns).map(id => deleteDesign(id)))
      setSelectedDesigns(new Set())
      setShowDeleteConfirm(false)
      addToast(`${selectedDesigns.size} designs deleted`, 'success')
    } catch (err) {
      addToast(err.message || 'Failed to delete designs', 'error')
    }
  }

  const toggleSelection = (id) => {
    setSelectedDesigns(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Filter designs
  const filteredDesigns = useMemo(() => {
    let filtered = designs.filter(d =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.description && d.description.toLowerCase().includes(searchQuery.toLowerCase()))
    )

    if (activeFilter === 'repo') {
      filtered = filtered.filter(d => d.repoUrl)
    } else if (activeFilter === 'normal') {
      filtered = filtered.filter(d => !d.repoUrl)
    } else if (activeFilter === 'active') {
      filtered = filtered.filter(d => d.status === 'active')
    } else if (activeFilter === 'draft') {
      filtered = filtered.filter(d => d.status === 'draft')
    }

    return filtered
  }, [designs, searchQuery, activeFilter])

  const ACCENT_PRESETS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
    '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7'
  ]

  return (
    <div className="min-h-screen bg-resonance-bg-primary">
      {/* Overview Stats */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-4">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-resonance-text-primary">Overview</h1>
            <p className="text-sm text-resonance-text-secondary mt-1">All your system designs and simulations</p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => setShowImportModal(true)} variant="secondary" className="gap-2">
              <Github size={16} />
              Import from GitHub
            </Button>
            <Button onClick={() => setShowNewModal(true)} className="gap-2">
              <Plus size={16} />
              Create Design
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-resonance-bg-secondary border border-resonance-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-resonance-accent/10 flex items-center justify-center">
                <FolderOpen size={20} className="text-resonance-accent" />
              </div>
            </div>
            <p className="text-2xl font-bold text-resonance-text-primary">{stats.total}</p>
            <p className="text-xs text-resonance-text-muted mt-1">Total Designs</p>
          </div>
          <div className="bg-resonance-bg-secondary border border-resonance-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Activity size={20} className="text-green-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-resonance-text-primary">{stats.active}</p>
            <p className="text-xs text-resonance-text-muted mt-1">Active</p>
          </div>
          <div className="bg-resonance-bg-secondary border border-resonance-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock size={20} className="text-amber-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-resonance-text-primary">{stats.totalBlocks}</p>
            <p className="text-xs text-resonance-text-muted mt-1">Simulations</p>
          </div>
          <div className="bg-resonance-bg-secondary border border-resonance-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <GitBranch size={20} className="text-blue-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-resonance-text-primary">{stats.withRepo}</p>
            <p className="text-xs text-resonance-text-muted mt-1">Connected Repos</p>
          </div>
        </div>
      </div>

      {/* Designs Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Input
              type="text"
              placeholder="Search designs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={Search}
              className="w-64"
            />

            {/* Filter tabs */}
            <div className="flex items-center bg-resonance-bg-secondary rounded-lg p-1 border border-resonance-border">
              {[
                { id: 'all', label: 'All' },
                { id: 'active', label: 'Active' },
                { id: 'draft', label: 'Draft' },
                { id: 'repo', label: 'From GitHub' },
                { id: 'normal', label: 'Manual' },
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeFilter === filter.id 
                      ? 'bg-resonance-accent text-white' 
                      : 'text-resonance-text-muted hover:text-resonance-text-primary'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-resonance-bg-secondary rounded-lg p-1 border border-resonance-border">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-resonance-accent text-white' : 'text-resonance-text-muted hover:text-resonance-text-primary'}`}
              >
                <LayoutGrid size={16} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-resonance-accent text-white' : 'text-resonance-text-muted hover:text-resonance-text-primary'}`}
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedDesigns.size > 0 && (
          <div className="sticky top-0 z-20 bg-resonance-accent/10 border border-resonance-accent/30 rounded-xl backdrop-blur-sm mb-6 animate-slide-down">
            <div className="px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-medium text-resonance-accent">
                {selectedDesigns.size} selected
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelectedDesigns(new Set())}>
                  <X size={14} className="mr-1" />
                  Clear
                </Button>
                <Button variant="danger" size="sm" onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 size={14} className="mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Create New Card + Design Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-resonance-accent" />
          </div>
        ) : filteredDesigns.length === 0 ? (
          <div className="text-center py-20">
            <Layers size={48} className="mx-auto text-resonance-text-muted mb-4" />
            <h3 className="text-lg font-semibold text-resonance-text-primary mb-2">
              {searchQuery ? 'No designs found' : 'No designs yet'}
            </h3>
            <p className="text-sm text-resonance-text-secondary mb-6">
              {searchQuery ? 'Try adjusting your search' : 'Create your first design or import from GitHub'}
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => setShowImportModal(true)} variant="secondary">
                <Github size={16} className="mr-2" />
                Import from GitHub
              </Button>
              <Button onClick={() => setShowNewModal(true)}>
                <Plus size={16} className="mr-2" />
                Create Design
              </Button>
            </div>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
            {/* Create New Card */}
            <div 
              className="rounded-xl border border-dashed border-resonance-border bg-resonance-bg-secondary/50 hover:bg-resonance-bg-secondary transition-all cursor-pointer flex flex-col items-center justify-center min-h-[240px] group"
              onClick={() => setShowNewModal(true)}
            >
              <div className="w-14 h-14 rounded-2xl bg-resonance-bg-tertiary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Plus size={28} className="text-resonance-text-muted" />
              </div>
              <p className="text-sm font-medium text-resonance-text-primary">Create new design</p>
              <p className="text-xs text-resonance-text-muted mt-1">Start from scratch</p>
            </div>

            {filteredDesigns.map((design) => (
              <DesignCard
                key={design.id}
                design={design}
                viewMode={viewMode}
                selected={selectedDesigns.has(design.id)}
                onSelect={() => toggleSelection(design.id)}
                onClick={() => navigate(`/design/${design.id}`)}
                onEdit={handleEditDesign}
                onDelete={handleDeleteDesign}
                onDuplicate={handleDuplicateDesign}
              />
            ))}
          </div>
        )}
      </div>

      {/* New Design Modal */}
      <Modal isOpen={showNewModal} onClose={() => setShowNewModal(false)} title="Create New Design">
        <div className="space-y-4">
          <Input
            label="Design Name"
            placeholder="e.g., E-Commerce Platform"
            value={newDesignName}
            onChange={(e) => setNewDesignName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateDesign()}
            autoFocus
          />
          <div className="space-y-2">
            <label className="text-sm font-medium text-resonance-text-primary">Description</label>
            <textarea
              value={newDesignDescription}
              onChange={(e) => setNewDesignDescription(e.target.value)}
              placeholder="Add a description..."
              rows={3}
              className="w-full px-3 py-2 bg-resonance-bg-tertiary border border-resonance-border rounded-lg text-sm text-resonance-text-primary placeholder-resonance-text-muted focus:outline-none focus:ring-2 focus:ring-resonance-accent/30 focus:border-resonance-accent transition-all resize-none"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowNewModal(false)}>Cancel</Button>
            <Button onClick={handleCreateDesign} disabled={!newDesignName.trim()}>
              Create Design
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Design Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Design">
        <div className="space-y-4">
          <Input
            label="Design Name"
            placeholder="Design name"
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
            <Button onClick={handleSaveEdit} disabled={!editName.trim()}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      {/* GitHub Import Modal */}
      <GitHubImportModal
        isOpen={showImportModal}
        onClose={() => !isImporting && setShowImportModal(false)}
        onImport={handleGitHubImport}
      />

      {/* Delete Confirmation */}
      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete Designs" size="sm">
        <div className="space-y-4">
          <p className="text-resonance-text-secondary">
            Are you sure you want to delete {selectedDesigns.size} design{selectedDesigns.size !== 1 ? 's' : ''}? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleBulkDelete}>Delete</Button>
          </div>
        </div>
      </Modal>

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg border flex items-center gap-2 min-w-[300px] animate-slide-up ${
              toast.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
              toast.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
              'bg-resonance-bg-secondary border-resonance-border text-resonance-text-primary'
            }`}
          >
            <span className="text-sm">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Import Loading Overlay */}
      {isImporting && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in">
          <div className="bg-resonance-bg-secondary border border-resonance-border rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl animate-scale-in">
            <div className="flex flex-col items-center gap-4">
              <Loader2 size={40} className="animate-spin text-resonance-accent" />
              <div className="text-center">
                <h3 className="text-lg font-semibold text-resonance-text-primary mb-1">
                  Importing from GitHub
                </h3>
                <p className="text-sm text-resonance-text-secondary">{importProgress}</p>
              </div>
              <div className="w-full h-1.5 bg-resonance-bg-tertiary rounded-full overflow-hidden">
                <div className="h-full bg-resonance-accent rounded-full animate-progress" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}