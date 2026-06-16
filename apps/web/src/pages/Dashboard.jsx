import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { useDesignStore } from '@/stores/designStore'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { DesignCard } from '@/components/ui/DesignCard'
import { GitHubImportModal } from '@/components/canvas/GitHubImportModal'
import { Loader2, Plus, Search, Github, LayoutGrid, List, Trash2, X, Layers } from 'lucide-react'
import { api } from '@/services/api'

export const Dashboard = () => {
  const navigate = useNavigate()
  const { user, isLoaded: authLoaded } = useAuth()
  const { designs, loadDesigns, createDesign, deleteDesign, isLoading } = useDesignStore()

  const [showNewModal, setShowNewModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [newDesignName, setNewDesignName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState('grid')
  const [selectedDesigns, setSelectedDesigns] = useState(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [toasts, setToasts] = useState([])

  // Import loading state
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState('')

  useEffect(() => {
    if (authLoaded && user) {
      loadDesigns()
    }
  }, [authLoaded, user, loadDesigns])

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  const handleCreateDesign = async () => {
    if (!newDesignName.trim()) return
    try {
      const design = await createDesign({ name: newDesignName.trim() })
      setShowNewModal(false)
      setNewDesignName('')
      addToast('Design created successfully', 'success')
      navigate(`/design/${design.id}`)
    } catch (err) {
      addToast(err.message || 'Failed to create design', 'error')
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
      })

      setImportProgress('Analyzing codebase ...')
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      const token = await api.getAuthToken?.()
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
      addToast(`AI: ${result.metadata?.description || 'Architecture generated'}`, 'success')

      setImportProgress('Finalizing...')
      await new Promise(r => setTimeout(r, 1500))

      setShowImportModal(false)
      setIsImporting(false)
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

  const filteredDesigns = designs.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.description && d.description.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className="min-h-screen bg-resonance-bg-primary">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-resonance-bg-primary/80 backdrop-blur-xl border-b border-resonance-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-resonance-text-primary">My Designs</h1>
              <span className="text-sm text-resonance-text-muted">{designs.length} total</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-resonance-text-muted" />
                <Input
                  type="text"
                  placeholder="Search designs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>

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

              <Button onClick={() => setShowImportModal(true)} variant="secondary">
                <Github size={16} className="mr-2" />
                Import
              </Button>

              <Button onClick={() => setShowNewModal(true)}>
                <Plus size={16} className="mr-2" />
                New Design
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Bulk Actions Bar */}
      {selectedDesigns.size > 0 && (
        <div className="sticky top-16 z-20 bg-resonance-accent/10 border-b border-resonance-accent/30 backdrop-blur-sm animate-slide-down">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
            {filteredDesigns.map((design) => (
              <DesignCard
                key={design.id}
                design={design}
                viewMode={viewMode}
                selected={selectedDesigns.has(design.id)}
                onSelect={() => toggleSelection(design.id)}
                onClick={() => navigate(`/design/${design.id}`)}
                onDelete={() => handleDeleteDesign(design.id)}
              />
            ))}
          </div>
        )}
      </main>

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
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowNewModal(false)}>Cancel</Button>
            <Button onClick={handleCreateDesign} disabled={!newDesignName.trim()}>
              Create Design
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