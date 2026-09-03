import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { useDesignStore } from '@/stores/designStore'
import { useChatStore } from '@/stores/chatStore'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { DesignCard, getRandomAccent } from '@/components/ui/DesignCard'
import { GitHubImportModal } from '@/components/canvas/GitHubImportModal'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { DashboardSkeleton } from '@/components/ui/skeletons'
import {
  Loader2, Plus, Search, Github, Trash2, X, Layers,
  FolderOpen, Activity, Zap, DollarSign, Clock, GitBranch
} from 'lucide-react'
import { api } from '@/services/api'

/* ------------------------------------------------------------------ */
// Helpers
/* ------------------------------------------------------------------ */

const formatRelativeTime = (date) => {
  const now = new Date()
  const diff = Math.floor((now - date) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return `${Math.floor(diff / 604800)}w ago`
}

/* ------------------------------------------------------------------ */
// Dashboard
/* ------------------------------------------------------------------ */

export const Dashboard = () => {
  const navigate = useNavigate()
  const { isSignedIn, isLoaded: authLoaded } = useAuth()

  const designs = useDesignStore(state => state.designs)
  const isLoading = useDesignStore(state => state.isLoading)
  const loadDesigns = useDesignStore(state => state.loadDesigns)
  const createDesign = useDesignStore(state => state.createDesign)
  const deleteDesign = useDesignStore(state => state.deleteDesign)
  const updateDesign = useDesignStore(state => state.updateDesign)
  const startDesignChat = useChatStore(state => state.startDesignChat)

  const [showNewModal, setShowNewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [newDesignName, setNewDesignName] = useState('')
  const [newDesignDescription, setNewDesignDescription] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [selectedDesigns, setSelectedDesigns] = useState(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [toasts, setToasts] = useState([])
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState('')

  // Edit state
  const [editingDesign, setEditingDesign] = useState(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editAccent, setEditAccent] = useState('')

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

  /* ------------------------ Real data transforms ------------------------ */

  const enrichedDesigns = useMemo(() => {
    return designs.map(d => {
      const status =
        d.status === 'active' ? 'production'
        : d.status === 'review' ? 'review'
        : d.status === 'archived' ? 'archived'
        : 'draft'

      const projectedCost = d.latestSimulation?.projectedMonthlyCost
        ? `$${(d.latestSimulation.projectedMonthlyCost / 1000).toFixed(1)}k`
        : '—'

      const lastSim = d.latestSimulation?.createdAt
        ? formatRelativeTime(new Date(d.latestSimulation.createdAt))
        : null

      return {
        ...d,
        score: d.latestReport?.overallScore || 0,
        status,
        projectedCost,
        edges: d.edges || 0,
        lastSim,
        updatedAtLabel: formatRelativeTime(new Date(d.updatedAt)),
        team: d.team || [],
        scenario: d.latestSimulation?.scenario || 'No simulations',
      }
    })
  }, [designs])

  /* ------------------------ Stats ------------------------ */

  const stats = useMemo(() => {
    const total = designs.length
    const sims = designs.reduce((sum, d) => sum + (d.simulations || 0), 0)

    const scored = designs.filter(d => d.latestReport?.overallScore != null)
    const avgScore = scored.length
      ? Math.round(scored.reduce((s, d) => s + d.latestReport.overallScore, 0) / scored.length)
      : 0

    const totalMonthly = designs.reduce(
      (sum, d) => sum + (d.latestSimulation?.projectedMonthlyCost || 0),
      0
    )
    const costText =
      totalMonthly > 1000 ? `$${(totalMonthly / 1000).toFixed(1)}k`
      : totalMonthly > 0 ? `$${totalMonthly.toFixed(0)}`
      : '—'

    return { total, sims, avgScore, costText }
  }, [designs])

  /* ------------------------ Handlers ------------------------ */

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

  const handleChatAboutDesign = async (design) => {
    try {
      await startDesignChat(design)
      navigate('/')
    } catch (err) {
      addToast(err?.message || 'Could not start chat', 'error')
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

  /* ------------------------ Filters ------------------------ */

  const filteredDesigns = useMemo(() => {
    let filtered = enrichedDesigns.filter(d =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.description && d.description.toLowerCase().includes(searchQuery.toLowerCase()))
    )

    if (activeFilter === 'draft') {
      filtered = filtered.filter(d => d.status === 'draft')
    } else if (activeFilter === 'review') {
      filtered = filtered.filter(d => d.status === 'review')
    } else if (activeFilter === 'production') {
      filtered = filtered.filter(d => d.status === 'production')
    } else if (activeFilter === 'archived') {
      filtered = filtered.filter(d => d.status === 'archived')
    }

    return filtered
  }, [enrichedDesigns, searchQuery, activeFilter])

  const ACCENT_PRESETS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
    '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7'
  ]

  const filterTabs = [
    { id: 'all', label: 'All Designs' },
    { id: 'draft', label: 'Draft' },
    { id: 'review', label: 'In Review' },
    { id: 'production', label: 'Production' },
    { id: 'archived', label: 'Archived' },
  ]

  const statCards = [
    { label: 'Total Designs', value: stats.total, icon: FolderOpen },
    { label: 'Simulations Run', value: stats.sims, icon: Zap },
    { label: 'Avg. Score', value: stats.avgScore, icon: Activity },
    { label: 'Projected Cost', value: stats.costText, icon: DollarSign },
  ]

  /* ------------------------ Render ------------------------ */

  // === SKELETON LOADING STATE ===
  if (isLoading && designs.length === 0) {
    return (
      <div className="min-h-screen bg-resonance-bg-primary">
        <DashboardSkeleton />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-resonance-bg-primary">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-12 py-8">

        {/* Top Header */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between mb-8 gap-4 animate-[fadeIn_400ms_ease-out_forwards]">
          <div>
            <h1 className="text-[30px] font-semibold leading-9 tracking-tight text-resonance-text-primary">
              Designs
            </h1>
            <p className="text-sm text-resonance-text-secondary mt-1">
              Manage your architecture designs and simulations
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Button onClick={() => setShowImportModal(true)} variant="secondary" className="gap-2">
              <Github size={16} />
              Import from GitHub
            </Button>

            <Button onClick={() => setShowNewModal(true)} className="gap-2">
              <Plus size={16} />
              New Design
            </Button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-[fadeIn_400ms_ease-out_50ms_forwards] opacity-0">
          {statCards.map((stat) => {
            const Icon = stat.icon
            return (
              <div
                key={stat.label}
                className="bg-resonance-bg-secondary border border-resonance-border rounded-xl p-5 hover:border-resonance-text-secondary hover:-translate-y-0.5 transition-all duration-150"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13px] font-medium uppercase tracking-wide text-resonance-text-secondary">
                    {stat.label}
                  </span>
                  <Icon size={16} className="text-resonance-text-secondary" />
                </div>
                <div className="text-[28px] font-bold tabular-nums tracking-tight text-resonance-text-primary">
                  {stat.value}
                </div>
              </div>
            )
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-3 animate-[fadeIn_400ms_ease-out_100ms_forwards] opacity-0">
          <div className="flex gap-1 bg-resonance-bg-secondary border border-resonance-border rounded-xl p-1 overflow-x-auto">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3.5 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap transition-all duration-150 ${
                  activeFilter === tab.id
                    ? 'bg-resonance-text-primary text-resonance-bg-secondary'
                    : 'text-resonance-text-secondary hover:text-resonance-text-primary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-resonance-text-muted" />
              <input
                type="text"
                placeholder="Search designs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 w-56 bg-resonance-bg-secondary border border-resonance-border rounded-lg text-xs text-resonance-text-primary placeholder:text-resonance-text-muted outline-none focus:border-resonance-text-primary transition-colors"
              />
            </div>
            <button className="inline-flex items-center gap-2 px-3 py-1.5 bg-resonance-bg-secondary border border-resonance-border rounded-lg text-xs font-medium text-resonance-text-primary hover:bg-resonance-bg-hover transition-all">
              <Clock size={14} /> Sort
            </button>
            <button className="inline-flex items-center gap-2 px-3 py-1.5 bg-resonance-bg-secondary border border-resonance-border rounded-lg text-xs font-medium text-resonance-text-primary hover:bg-resonance-bg-hover transition-all">
              <GitBranch size={14} /> Filter
            </button>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedDesigns.size > 0 && (
          <div className="sticky top-0 z-20 bg-resonance-accent/10 border border-resonance-accent/30 rounded-xl backdrop-blur-sm mb-6 animate-[slide-down_200ms_ease-out_forwards]">
            <div className="px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-medium text-resonance-neutral">
                {selectedDesigns.size} selected
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelectedDesigns(new Set())}>
                  <X size={14} className="mr-1" /> Clear
                </Button>
                <Button variant="danger" size="sm" onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 size={14} className="mr-1" /> Delete
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Design Grid */}
        {filteredDesigns.length === 0 ? (
          <div className="text-center py-20 animate-[fadeIn_400ms_ease-out_forwards]">
            <Layers size={48} className="mx-auto text-resonance-text-muted mb-4" />
            <h3 className="text-lg font-semibold text-resonance-text-primary mb-2">
              {searchQuery ? 'No designs found' : 'No designs yet'}
            </h3>
            <p className="text-sm text-resonance-text-secondary mb-6">
              {searchQuery ? 'Try adjusting your search' : 'Create your first design or import from GitHub'}
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => setShowImportModal(true)} variant="secondary">
                <Github size={16} className="mr-2" /> Import from GitHub
              </Button>
              <Button onClick={() => setShowNewModal(true)}>
                <Plus size={16} className="mr-2" /> Create Design
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 animate-[fadeIn_400ms_ease-out_150ms_forwards] opacity-0">
            {filteredDesigns.map((design) => (
              <DesignCard
                key={design.id}
                design={design}
                onChat={handleChatAboutDesign}
                onEdit={handleEditDesign}
                onDuplicate={handleDuplicateDesign}
                onDelete={handleDeleteDesign}
              />
            ))}
          </div>
        )}

        {/* ---------- Modals ---------- */}

        {/* New Design */}
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
                className="w-full px-3 py-2 bg-resonance-bg-tertiary border border-resonance-border rounded-xl text-sm text-resonance-text-primary placeholder:text-resonance-text-muted outline-none focus:ring-2 focus:ring-resonance-accent/30 focus:border-resonance-accent transition-all resize-none"
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

        {/* Edit Design */}
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
                className="w-full px-3 py-2 bg-resonance-bg-tertiary border border-resonance-border rounded-xl text-sm text-resonance-text-primary placeholder:text-resonance-text-muted outline-none focus:ring-2 focus:ring-resonance-accent/30 focus:border-resonance-accent transition-all resize-none"
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

        {/* GitHub Import */}
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
              className={`px-4 py-3 rounded-xl shadow-lg border flex items-center gap-2 min-w-[300px] animate-slide-up ${
                toast.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
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
                <LoadingSpinner size="lg" message={importProgress} />
                <div className="w-full h-1.5 bg-resonance-bg-tertiary rounded-full overflow-hidden">
                  <div className="h-full bg-resonance-accent rounded-full animate-progress" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}