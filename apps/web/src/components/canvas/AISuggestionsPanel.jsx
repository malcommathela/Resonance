import React, { useState, useEffect } from 'react'
import {
  Lightbulb,
  Zap,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  ArrowRight,
  Loader2,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
  Server,
  Database,
  HardDrive,
  Globe,
  Layers,
  Plus,
  Settings2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

const ICON_MAP = {
  'db-read-replica': Database,
  'cache-lru-to-lfu': Zap,
  'add-load-balancer': Layers,
  'scale-services': Server,
  'add-cdn': Globe,
  'db-connection-pool': HardDrive,
}

export const AISuggestionsPanel = ({ designId, simulationId, isOpen, onClose, onApply }) => {
  const [suggestions, setSuggestions] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [applyingId, setApplyingId] = useState(null)
  const [appliedIds, setAppliedIds] = useState(new Set())

  useEffect(() => {
    if (isOpen && simulationId) {
      loadSuggestions()
    }
  }, [isOpen, simulationId])

  const loadSuggestions = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const token = await window.__clerk?.session?.getToken?.()
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/optimize/analyze`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token || ''}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ simulationId, designId }),
        }
      )

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || 'Failed to analyze')
      }

      const result = await response.json()
      setSuggestions(result.suggestions || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleApply = async (suggestion) => {
    setApplyingId(suggestion.id)
    try {
      const token = await window.__clerk?.session?.getToken?.()
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/optimize/apply`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token || ''}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ designId, suggestionId: suggestion.id }),
        }
      )

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || 'Failed to apply')
      }

      const result = await response.json()
      setAppliedIds(prev => new Set(prev).add(suggestion.id))

      if (onApply) {
        onApply(result)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setApplyingId(null)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="AI Optimization Suggestions" size="lg">
      <div className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-400">
            <AlertCircle size={16} />
            <span className="text-sm">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-xs hover:text-red-300">Dismiss</button>
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 size={24} className="animate-spin text-resonance-accent" />
            <p className="text-sm text-resonance-text-secondary">Analyzing simulation results...</p>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <CheckCircle2 size={32} className="text-green-500" />
            <p className="text-sm text-resonance-text-secondary">No optimizations needed. Your architecture is performing well!</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-resonance-text-muted">
              <span>{suggestions.length} suggestions found</span>
              <span>Est. cost: ${suggestions.reduce((s, sug) => s + (sug.impact?.costIncrease || 0), 0)}/mo</span>
            </div>

            {suggestions.map((suggestion) => {
              const Icon = ICON_MAP[suggestion.id] || Lightbulb
              const isExpanded = expandedId === suggestion.id
              const isApplied = appliedIds.has(suggestion.id)
              const isApplying = applyingId === suggestion.id

              return (
                <div
                  key={suggestion.id}
                  className={`border rounded-xl overflow-hidden transition-all ${
                    isApplied ? 'border-green-500/30 bg-green-500/5' : 'border-resonance-border'
                  }`}
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : suggestion.id)}
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-resonance-bg-hover transition-colors"
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      isApplied ? 'bg-green-500/10' : 'bg-resonance-accent/10'
                    }`}>
                      <Icon size={18} className={isApplied ? 'text-green-500' : 'text-resonance-accent'} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-resonance-text-primary">{suggestion.name}</h4>
                        {isApplied && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-500">Applied</span>
                        )}
                      </div>
                      <p className="text-xs text-resonance-text-secondary truncate">{suggestion.description}</p>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      {suggestion.impact?.latencyReduction > 0 && (
                        <span className="flex items-center gap-1 text-green-500">
                          <TrendingUp size={12} />
                          -{suggestion.impact.latencyReduction}ms
                        </span>
                      )}
                      {suggestion.impact?.costIncrease > 0 && (
                        <span className="flex items-center gap-1 text-resonance-text-muted">
                          <DollarSign size={12} />
                          +${suggestion.impact.costIncrease}/mo
                        </span>
                      )}
                      <span className="text-resonance-text-muted">
                        {(suggestion.impact?.confidence * 100)?.toFixed(0)}% confidence
                      </span>
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-resonance-border">
                      <div className="pt-3 space-y-3">
                        {/* Impact Metrics */}
                        <div className="grid grid-cols-2 gap-2">
                          {suggestion.impact?.currentRps && suggestion.impact?.projectedRps && (
                            <div className="bg-resonance-bg-tertiary rounded-lg p-2.5">
                              <p className="text-xs text-resonance-text-muted">Throughput</p>
                              <div className="flex items-baseline gap-1">
                                <span className="text-sm font-semibold text-resonance-text-primary">{suggestion.impact.projectedRps?.toLocaleString()}</span>
                                <span className="text-xs text-green-500">RPS</span>
                              </div>
                              <p className="text-xs text-resonance-text-muted">from {suggestion.impact.currentRps?.toLocaleString()}</p>
                            </div>
                          )}

                          {suggestion.impact?.latencyReduction > 0 && (
                            <div className="bg-resonance-bg-tertiary rounded-lg p-2.5">
                              <p className="text-xs text-resonance-text-muted">Latency Reduction</p>
                              <div className="flex items-baseline gap-1">
                                <span className="text-sm font-semibold text-green-500">-{suggestion.impact.latencyReduction}ms</span>
                              </div>
                              <p className="text-xs text-resonance-text-muted">P95 improvement</p>
                            </div>
                          )}

                          {suggestion.impact?.throughputIncrease > 0 && (
                            <div className="bg-resonance-bg-tertiary rounded-lg p-2.5">
                              <p className="text-xs text-resonance-text-muted">Throughput Increase</p>
                              <div className="flex items-baseline gap-1">
                                <span className="text-sm font-semibold text-green-500">+{suggestion.impact.throughputIncrease}%</span>
                              </div>
                            </div>
                          )}

                          {suggestion.impact?.costIncrease > 0 && (
                            <div className="bg-resonance-bg-tertiary rounded-lg p-2.5">
                              <p className="text-xs text-resonance-text-muted">Additional Cost</p>
                              <div className="flex items-baseline gap-1">
                                <span className="text-sm font-semibold text-resonance-text-primary">+${suggestion.impact.costIncrease}</span>
                                <span className="text-xs text-resonance-text-muted">/mo</span>
                              </div>
                            </div>
                          )}

                          {suggestion.impact?.availabilityImprovement > 0 && (
                            <div className="bg-resonance-bg-tertiary rounded-lg p-2.5">
                              <p className="text-xs text-resonance-text-muted">Availability</p>
                              <div className="flex items-baseline gap-1">
                                <span className="text-sm font-semibold text-green-500">+{suggestion.impact.availabilityImprovement}%</span>
                              </div>
                            </div>
                          )}

                          {suggestion.impact?.hitRatioImprovement > 0 && (
                            <div className="bg-resonance-bg-tertiary rounded-lg p-2.5">
                              <p className="text-xs text-resonance-text-muted">Cache Hit Ratio</p>
                              <div className="flex items-baseline gap-1">
                                <span className="text-sm font-semibold text-green-500">+{suggestion.impact.hitRatioImprovement}%</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Action Preview */}
                        <div className="bg-resonance-bg-tertiary rounded-lg p-3">
                          <p className="text-xs font-medium text-resonance-text-secondary mb-2">What will change:</p>
                          <div className="space-y-1.5">
                            {suggestion.action?.type === 'add_block' && (
                              <div className="flex items-center gap-2 text-sm text-resonance-text-primary">
                                <Plus size={14} className="text-green-500" />
                                <span>Add <strong>{suggestion.action.label}</strong> block</span>
                              </div>
                            )}
                            {suggestion.action?.type === 'update_config' && (
                              <div className="flex items-center gap-2 text-sm text-resonance-text-primary">
                                <Settings2 size={14} className="text-amber-500" />
                                <span>Update <strong>{suggestion.action.blockType}</strong> configuration</span>
                              </div>
                            )}
                            {suggestion.action?.connectTo && (
                              <div className="flex items-center gap-2 text-sm text-resonance-text-primary">
                                <ArrowRight size={14} className="text-blue-500" />
                                <span>Connect to <strong>{suggestion.action.connectTo}</strong></span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Apply Button */}
                        {!isApplied && (
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setExpandedId(null)}>Close</Button>
                            <Button size="sm" icon={isApplying ? Loader2 : Zap} onClick={() => handleApply(suggestion)} disabled={isApplying}>
                              {isApplying ? 'Applying...' : 'Apply Optimization'}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Modal>
  )
}