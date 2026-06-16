import React, { useState, useEffect, useCallback } from 'react'
import {
  Search,
  GitBranch,
  ChevronRight,
  ChevronDown,
  Folder,
  FileCode,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Download,
  ArrowRight,
  ArrowLeft,
  Layers,
  Globe,
  Link,
} from 'lucide-react'
import { githubService } from '@/services/github'
import { api } from '@/services/api'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

const STEPS = [
  { id: 'repos', label: 'Select Repository' },
  { id: 'branch', label: 'Choose Branch' },
  { id: 'files', label: 'Review Files' },
  { id: 'import', label: 'Generate Architecture' },
]

export const GitHubImportModal = ({ isOpen, onClose, onImport }) => {
  // Tab state: 'my-repos' | 'public-url'
  const [activeTab, setActiveTab] = useState('my-repos')

  // My repos flow
  const [step, setStep] = useState(0)
  const [repos, setRepos] = useState([])
  const [selectedRepo, setSelectedRepo] = useState(null)
  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState('main')
  const [fileTree, setFileTree] = useState(null)
  const [selectedFiles, setSelectedFiles] = useState(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [repoPage, setRepoPage] = useState(1)
  const [importProgress, setImportProgress] = useState(0)
  const [importStatus, setImportStatus] = useState('idle') // idle | cloning | analyzing | generating | done
  const [githubConnected, setGithubConnected] = useState(true)

  // Public URL flow
  const [repoUrl, setRepoUrl] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [publicRepoError, setPublicRepoError] = useState(null)

  // Load repos on open (my-repos tab)
  useEffect(() => {
    if (isOpen && activeTab === 'my-repos' && step === 0) {
      loadRepos()
    }
  }, [isOpen, activeTab, step])

  const loadRepos = async (page = 1) => {
    setIsLoading(true)
    setError(null)
    setGithubConnected(true)
    try {
      const data = await githubService.getRepos(page)
      setRepos(page === 1 ? data : [...repos, ...data])
      setRepoPage(page)
    } catch (err) {
      if (err.message?.includes('GitHub token not found') || err.message?.includes('token') || err.message?.includes('401')) {
        setGithubConnected(false)
        setError('GitHub not connected. Connect your GitHub account in Settings, or use Public Repo URL below.')
      } else {
        setError(err.message)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const loadBranches = async (repo) => {
    setIsLoading(true)
    setError(null)
    try {
      const [owner, name] = repo.fullName.split('/')
      const data = await githubService.getBranches(owner, name)
      setBranches(data)
      setSelectedBranch(repo.defaultBranch || 'main')
      setSelectedRepo(repo)
      setStep(1)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const loadFileTree = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [owner, name] = selectedRepo.fullName.split('/')
      const data = await githubService.getTree(owner, name, selectedBranch)
      setFileTree(data)
      const autoSelected = new Set(data.files.map(f => f.path))
      setSelectedFiles(autoSelected)
      setStep(2)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleImport = async () => {
    setImportStatus('cloning')
    setImportProgress(10)
    setError(null)

    try {
      await githubService.cloneRepo(selectedRepo.cloneUrl, selectedBranch)
      setImportProgress(30)
      setImportStatus('analyzing')

      const clonedFiles = await githubService.getClonedFiles()
      setImportProgress(50)

      const filesToRead = clonedFiles.files.filter(f => selectedFiles.has(f.path))
      const fileContents = []

      for (let i = 0; i < filesToRead.length; i++) {
        const file = filesToRead[i]
        try {
          const content = await githubService.getClonedFile(file.path)
          fileContents.push({ path: file.path, content: content.content })
        } catch (e) {
          console.warn(`Failed to read ${file.path}:`, e)
        }
        setImportProgress(50 + Math.floor((i / filesToRead.length) * 40))
      }

      setImportProgress(90)
      setImportStatus('generating')

      await onImport({
        repo: selectedRepo,
        branch: selectedBranch,
        files: fileContents,
      })

      setImportProgress(100)
      setImportStatus('done')

      setTimeout(() => {
        githubService.deleteClone().catch(() => {})
        handleClose()
      }, 1000)
    } catch (err) {
      setError(err.message)
      setImportStatus('idle')
    }
  }

  // Public repo URL handler
  const handlePublicRepoImport = async () => {
    if (!repoUrl.trim()) return
    setIsAnalyzing(true)
    setPublicRepoError(null)
    try {
      const response = await api.request('/analyze/public-repo', {
        method: 'POST',
        body: JSON.stringify({ repoUrl: repoUrl.trim() })
      })

      // Backend returns analysis directly - create design and pass to onImport
      await onImport({
        repo: { 
          name: response.repo || 'public-repo', 
          fullName: response.repo || repoUrl.trim(), 
          url: repoUrl.trim() 
        },
        branch: 'main',
        files: [], // Backend already processed
        preGenerated: response // Pass the pre-generated nodes/edges
      })

      handleClose()
    } catch (err) {
      setPublicRepoError(err.message || 'Failed to analyze repository')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const toggleFile = (path) => {
    setSelectedFiles(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const handleClose = () => {
    setStep(0)
    setRepos([])
    setSelectedRepo(null)
    setBranches([])
    setSelectedBranch('main')
    setFileTree(null)
    setSelectedFiles(new Set())
    setError(null)
    setSearchQuery('')
    setImportProgress(0)
    setImportStatus('idle')
    setGithubConnected(true)
    setActiveTab('my-repos')
    setRepoUrl('')
    setPublicRepoError(null)
    onClose()
  }

  const filteredRepos = repos.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const renderTabs = () => (
    <div className="flex gap-2 mb-4 border-b border-resonance-border pb-4">
      <button
        onClick={() => setActiveTab('my-repos')}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
          activeTab === 'my-repos' 
            ? 'bg-resonance-accent text-white' 
            : 'bg-resonance-bg-elevated text-resonance-text-muted hover:text-resonance-text-primary'
        }`}
      >
        <GitBranch size={14} className="inline mr-2" />
        My Repositories
      </button>
      <button
        onClick={() => setActiveTab('public-url')}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
          activeTab === 'public-url' 
            ? 'bg-resonance-accent text-white' 
            : 'bg-resonance-bg-elevated text-resonance-text-muted hover:text-resonance-text-primary'
        }`}
      >
        <Globe size={14} className="inline mr-2" />
        Public Repo URL
      </button>
    </div>
  )

  const renderPublicUrlTab = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <Globe size={32} className="mx-auto text-resonance-accent" />
        <h3 className="text-lg font-semibold text-resonance-text-primary">Import from Public Repository</h3>
        <p className="text-sm text-resonance-text-secondary">
          Paste any public GitHub repository URL. No GitHub account connection required.
        </p>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Link size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-resonance-text-muted" />
          <input
            type="text"
            placeholder="https://github.com/vercel/next.js"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-resonance-bg-elevated border border-resonance-border rounded-xl text-resonance-text-primary placeholder:text-resonance-text-muted focus:outline-none focus:border-resonance-accent/50 focus:ring-1 focus:ring-resonance-accent/20"
          />
        </div>
        <p className="text-xs text-resonance-text-muted">
          Supports any public GitHub repo. Example: https://github.com/facebook/react
        </p>
      </div>

      {publicRepoError && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-400">
          <AlertCircle size={16} />
          <span className="text-sm">{publicRepoError}</span>
        </div>
      )}

      <button
        onClick={handlePublicRepoImport}
        disabled={!repoUrl.trim() || isAnalyzing}
        className="w-full px-6 py-3 bg-resonance-accent text-white rounded-xl font-medium hover:bg-resonance-accent/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
        {isAnalyzing ? 'Analyzing Repository...' : 'Analyze Repository'}
      </button>
    </div>
  )

  const renderStepIndicator = () => (
    <div className="flex items-center gap-2 mb-6">
      {STEPS.map((s, i) => (
        <React.Fragment key={s.id}>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
            i === step ? 'bg-resonance-accent text-white' :
            i < step ? 'bg-green-500/10 text-green-500' :
            'bg-resonance-bg-tertiary text-resonance-text-muted'
          }`}>
            {i < step ? <CheckCircle2 size={12} /> : <span>{i + 1}</span>}
            <span className="hidden sm:inline">{s.label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <ChevronRight size={14} className={i < step ? 'text-green-500' : 'text-resonance-text-muted'} />
          )}
        </React.Fragment>
      ))}
    </div>
  )

  const renderReposStep = () => (
    <div className="space-y-4">
      {!githubConnected && (
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-3">
          <div className="flex items-center gap-2 text-amber-400">
            <AlertCircle size={16} />
            <span className="text-sm font-medium">GitHub Not Connected</span>
          </div>
          <p className="text-sm text-amber-400/80">
            You need to connect your GitHub account to access your private repositories. 
            Alternatively, use the <strong>Public Repo URL</strong> tab to import any public repository.
          </p>
          <button
            onClick={() => setActiveTab('public-url')}
            className="text-sm text-resonance-accent hover:text-resonance-accent-hover font-medium"
          >
            Switch to Public Repo URL →
          </button>
        </div>
      )}

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-resonance-text-muted" />
        <input
          type="text"
          placeholder="Search your repositories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-resonance-bg-tertiary border border-resonance-border rounded-lg text-sm text-resonance-text-primary placeholder-resonance-text-muted focus:outline-none focus:ring-2 focus:ring-resonance-accent/30"
        />
      </div>

      {isLoading && repos.length === 0 ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 bg-resonance-bg-tertiary rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-1 max-h-[300px] overflow-y-auto">
          {filteredRepos.map(repo => (
            <button
              key={repo.id}
              onClick={() => loadBranches(repo)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-resonance-bg-hover transition-colors text-left group"
            >
              <div className="w-8 h-8 rounded-lg bg-resonance-bg-tertiary group-hover:bg-resonance-accent/10 flex items-center justify-center shrink-0">
                <GitBranch size={14} className="text-resonance-text-muted group-hover:text-resonance-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-resonance-text-primary truncate">{repo.name}</p>
                <p className="text-xs text-resonance-text-muted truncate">{repo.fullName}</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-resonance-text-muted">
                {repo.language && <span>{repo.language}</span>}
                <span>★ {repo.stars}</span>
                {repo.private && <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500">Private</span>}
              </div>
              <ChevronRight size={14} className="text-resonance-text-muted" />
            </button>
          ))}
        </div>
      )}

      {repos.length > 0 && filteredRepos.length === repos.length && (
        <button
          onClick={() => loadRepos(repoPage + 1)}
          disabled={isLoading}
          className="w-full py-2 text-sm text-resonance-text-secondary hover:text-resonance-accent transition-colors"
        >
          {isLoading ? 'Loading...' : 'Load more repositories'}
        </button>
      )}
    </div>
  )

  const renderBranchStep = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-resonance-text-secondary mb-2">
        <GitBranch size={14} />
        <span>{selectedRepo?.fullName}</span>
      </div>

      <p className="text-sm text-resonance-text-secondary">Select a branch to analyze:</p>

      <div className="space-y-1 max-h-[300px] overflow-y-auto">
        {branches.map(branch => (
          <button
            key={branch.name}
            onClick={() => setSelectedBranch(branch.name)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
              selectedBranch === branch.name
                ? 'bg-resonance-accent/10 border border-resonance-accent/30'
                : 'hover:bg-resonance-bg-hover'
            }`}
          >
            <GitBranch size={14} className={selectedBranch === branch.name ? 'text-resonance-accent' : 'text-resonance-text-muted'} />
            <span className={`text-sm font-medium ${selectedBranch === branch.name ? 'text-resonance-accent' : 'text-resonance-text-primary'}`}>
              {branch.name}
            </span>
            {branch.protected && (
              <span className="ml-auto text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">Protected</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={() => setStep(0)}>Back</Button>
        <Button onClick={loadFileTree} disabled={isLoading} icon={isLoading ? Loader2 : null}>
          {isLoading ? 'Loading...' : 'Continue'}
        </Button>
      </div>
    </div>
  )

  const renderFilesStep = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-resonance-text-secondary">
          {selectedFiles.size} of {fileTree?.files?.length || 0} files selected
        </p>
        <button
          onClick={() => setSelectedFiles(new Set(fileTree?.files?.map(f => f.path) || []))}
          className="text-xs text-resonance-accent hover:text-resonance-accent-hover"
        >
          Select all
        </button>
      </div>

      <div className="space-y-1 max-h-[300px] overflow-y-auto border border-resonance-border rounded-lg">
        {fileTree?.files?.map(file => {
          const isSelected = selectedFiles.has(file.path)
          return (
            <button
              key={file.path}
              onClick={() => toggleFile(file.path)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                isSelected ? 'bg-resonance-accent/5' : 'hover:bg-resonance-bg-hover'
              }`}
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                isSelected ? 'bg-resonance-accent border-resonance-accent' : 'border-resonance-text-muted'
              }`}>
                {isSelected && <CheckCircle2 size={12} className="text-white" />}
              </div>
              <FileCode size={14} className="text-resonance-text-muted shrink-0" />
              <span className="text-sm text-resonance-text-primary truncate">{file.path}</span>
              <span className="ml-auto text-xs text-resonance-text-muted">{(file.size / 1024).toFixed(1)} KB</span>
            </button>
          )
        })}
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
        <Button onClick={() => setStep(3)} disabled={selectedFiles.size === 0}>
          Continue
        </Button>
      </div>
    </div>
  )

  const renderImportStep = () => (
    <div className="space-y-6">
      {importStatus === 'idle' && (
        <>
          <div className="text-center space-y-2">
            <Layers size={32} className="mx-auto text-resonance-accent" />
            <h3 className="text-lg font-semibold text-resonance-text-primary">Ready to Generate</h3>
            <p className="text-sm text-resonance-text-secondary">
              We will analyze {selectedFiles.size} files from <strong>{selectedRepo?.fullName}</strong> ({selectedBranch})
              and auto-generate an architecture diagram.
            </p>
          </div>

          <div className="bg-resonance-bg-tertiary rounded-lg p-4 space-y-2">
            <p className="text-xs font-medium text-resonance-text-secondary uppercase tracking-wider">Selected Files</p>
            <div className="max-h-[150px] overflow-y-auto space-y-1">
              {Array.from(selectedFiles).slice(0, 10).map(path => (
                <div key={path} className="flex items-center gap-2 text-xs text-resonance-text-primary">
                  <FileCode size={12} className="text-resonance-text-muted" />
                  <span className="truncate">{path}</span>
                </div>
              ))}
              {selectedFiles.size > 10 && (
                <p className="text-xs text-resonance-text-muted">...and {selectedFiles.size - 10} more</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
            <Button onClick={handleImport} icon={RefreshCw}>
              Generate Architecture
            </Button>
          </div>
        </>
      )}

      {importStatus !== 'idle' && importStatus !== 'done' && (
        <div className="space-y-4">
          <div className="text-center space-y-2">
            <Loader2 size={32} className="mx-auto animate-spin text-resonance-accent" />
            <h3 className="text-lg font-semibold text-resonance-text-primary">
              {importStatus === 'cloning' && 'Cloning Repository...'}
              {importStatus === 'analyzing' && 'Analyzing Files...'}
              {importStatus === 'generating' && 'Generating Architecture...'}
            </h3>
          </div>

          <div className="w-full bg-resonance-bg-tertiary rounded-full h-2 overflow-hidden">
            <div
              className="bg-resonance-accent h-full transition-all duration-500"
              style={{ width: `${importProgress}%` }}
            />
          </div>

          <p className="text-center text-sm text-resonance-text-muted">{importProgress}% complete</p>
        </div>
      )}

      {importStatus === 'done' && (
        <div className="text-center space-y-2">
          <CheckCircle2 size={32} className="mx-auto text-green-500" />
          <h3 className="text-lg font-semibold text-resonance-text-primary">Architecture Generated!</h3>
          <p className="text-sm text-resonance-text-secondary">Redirecting to canvas...</p>
        </div>
      )}
    </div>
  )

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import from GitHub" size="lg">
      <div className="space-y-4">
        {renderTabs()}

        {activeTab === 'public-url' && renderPublicUrlTab()}

        {activeTab === 'my-repos' && (
          <>
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-400">
                <AlertCircle size={16} />
                <span className="text-sm">{error}</span>
                <button onClick={() => setError(null)} className="ml-auto text-xs hover:text-red-300">Dismiss</button>
              </div>
            )}

            {step === 0 && renderReposStep()}
            {step === 1 && renderBranchStep()}
            {step === 2 && renderFilesStep()}
            {step === 3 && renderImportStep()}
          </>
        )}
      </div>
    </Modal>
  )
}