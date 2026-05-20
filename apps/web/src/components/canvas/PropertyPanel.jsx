import React from 'react'
import {
  X,
  Trash2,
  Copy,
  Settings,
} from 'lucide-react'
import { useCanvasStore } from '@/stores/canvasStore'
import { blockIconMap } from '@/lib/iconMap'
import { Button } from '@/components/ui/Button'

export const PropertyPanel = () => {
  const { selectedNode, updateNode, removeNode, setSelectedNode } = useCanvasStore()

  if (!selectedNode) {
    return (
      <div className="w-72 bg-resonance-bg-panel border-l border-resonance-border flex flex-col shrink-0">
        <div className="p-4 border-b border-resonance-border">
          <h3 className="text-sm font-semibold text-resonance-text-primary">Properties</h3>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Settings size={32} className="text-resonance-text-muted mb-3" />
          <p className="text-sm text-resonance-text-secondary">Select a block to edit its properties</p>
          <p className="text-xs text-resonance-text-muted mt-2">Click on any block in the canvas</p>
        </div>
      </div>
    )
  }

  const { data } = selectedNode
  const IconComponent = blockIconMap[data.type] || blockIconMap['service']

  const handleConfigChange = (key, value) => {
    updateNode(selectedNode.id, {
      config: { ...data.config, [key]: value }
    })
  }

  const handleLabelChange = (value) => {
    updateNode(selectedNode.id, { label: value })
  }

  const renderConfigFields = () => {
    const config = data.config || {}

    switch (data.type) {
      case 'api-gateway':
        return (
          <>
            <ConfigField label="Rate Limit" value={config.rateLimit} onChange={(v) => handleConfigChange('rateLimit', parseInt(v) || 0)} type="number" />
            <ConfigField label="Auth Type" value={config.authType} onChange={(v) => handleConfigChange('authType', v)} options={['jwt', 'oauth2', 'api-key', 'none']} />
            <ConfigField label="Timeout (ms)" value={config.timeout} onChange={(v) => handleConfigChange('timeout', parseInt(v) || 0)} type="number" />
            <ConfigField label="Port" value={config.port} onChange={(v) => handleConfigChange('port', parseInt(v) || 0)} type="number" />
          </>
        )
      case 'service':
        return (
          <>
            <ConfigField label="Port" value={config.port} onChange={(v) => handleConfigChange('port', parseInt(v) || 0)} type="number" />
            <ConfigField label="Replicas" value={config.replicas} onChange={(v) => handleConfigChange('replicas', parseInt(v) || 1)} type="number" />
            <ConfigField label="CPU" value={config.cpu} onChange={(v) => handleConfigChange('cpu', v)} />
            <ConfigField label="Memory" value={config.memory} onChange={(v) => handleConfigChange('memory', v)} />
          </>
        )
      case 'database':
        return (
          <>
            <ConfigField label="Engine" value={config.engine} onChange={(v) => handleConfigChange('engine', v)} options={['postgres', 'mysql', 'mongodb', 'redis']} />
            <ConfigField label="Database" value={config.database} onChange={(v) => handleConfigChange('database', v)} />
            <ConfigField label="User" value={config.user} onChange={(v) => handleConfigChange('user', v)} />
            <ConfigField label="Password" value={config.password} onChange={(v) => handleConfigChange('password', v)} type="password" />
            <ConfigField label="Port" value={config.port} onChange={(v) => handleConfigChange('port', parseInt(v) || 0)} type="number" />
          </>
        )
      case 'cache':
        return (
          <>
            <ConfigField label="Engine" value={config.engine} onChange={(v) => handleConfigChange('engine', v)} options={['redis', 'memcached']} />
            <ConfigField label="Max Memory" value={config.maxMemory} onChange={(v) => handleConfigChange('maxMemory', v)} />
            <ConfigField label="Eviction" value={config.eviction} onChange={(v) => handleConfigChange('eviction', v)} options={['allkeys-lru', 'allkeys-lfu', 'volatile-lru', 'noeviction']} />
            <ConfigField label="Port" value={config.port} onChange={(v) => handleConfigChange('port', parseInt(v) || 0)} type="number" />
          </>
        )
      case 'message-queue':
        return (
          <>
            <ConfigField label="Engine" value={config.engine} onChange={(v) => handleConfigChange('engine', v)} options={['kafka', 'rabbitmq', 'sqs']} />
            <ConfigField label="Partitions" value={config.partitions} onChange={(v) => handleConfigChange('partitions', parseInt(v) || 1)} type="number" />
            <ConfigField label="Replication" value={config.replication} onChange={(v) => handleConfigChange('replication', parseInt(v) || 1)} type="number" />
            <ConfigField label="Port" value={config.port} onChange={(v) => handleConfigChange('port', parseInt(v) || 0)} type="number" />
          </>
        )
      case 'load-balancer':
        return (
          <>
            <ConfigField label="Algorithm" value={config.algorithm} onChange={(v) => handleConfigChange('algorithm', v)} options={['round-robin', 'least-connections', 'ip-hash', 'weighted']} />
            <ConfigField label="Health Check" value={config.healthCheck} onChange={(v) => handleConfigChange('healthCheck', v)} type="checkbox" />
            <ConfigField label="Port" value={config.port} onChange={(v) => handleConfigChange('port', parseInt(v) || 0)} type="number" />
          </>
        )
      case 'cdn':
        return (
          <>
            <ConfigField label="Provider" value={config.provider} onChange={(v) => handleConfigChange('provider', v)} options={['cloudfront', 'cloudflare', 'fastly']} />
            <ConfigField label="Caching" value={config.caching} onChange={(v) => handleConfigChange('caching', v)} />
            <ConfigField label="SSL" value={config.ssl} onChange={(v) => handleConfigChange('ssl', v)} type="checkbox" />
          </>
        )
      case 'client':
        return (
          <>
            <ConfigField label="Framework" value={config.framework} onChange={(v) => handleConfigChange('framework', v)} options={['react', 'vue', 'angular', 'svelte']} />
            <ConfigField label="SSR" value={config.ssr} onChange={(v) => handleConfigChange('ssr', v)} type="checkbox" />
            <ConfigField label="Caching" value={config.caching} onChange={(v) => handleConfigChange('caching', v)} type="checkbox" />
          </>
        )
      case 'external-api':
        return (
          <>
            <ConfigField label="URL" value={config.url} onChange={(v) => handleConfigChange('url', v)} />
            <ConfigField label="Auth" value={config.auth} onChange={(v) => handleConfigChange('auth', v)} options={['api-key', 'oauth2', 'basic', 'none']} />
            <ConfigField label="Rate Limit" value={config.rateLimit} onChange={(v) => handleConfigChange('rateLimit', parseInt(v) || 0)} type="number" />
          </>
        )
      case 'storage':
        return (
          <>
            <ConfigField label="Provider" value={config.provider} onChange={(v) => handleConfigChange('provider', v)} options={['s3', 'gcs', 'azure']} />
            <ConfigField label="Encryption" value={config.encryption} onChange={(v) => handleConfigChange('encryption', v)} type="checkbox" />
            <ConfigField label="Region" value={config.region} onChange={(v) => handleConfigChange('region', v)} />
          </>
        )
      default:
        return <p className="text-sm text-resonance-text-muted">No configurable properties</p>
    }
  }

  return (
    <div className="w-72 bg-resonance-bg-panel border-l border-resonance-border flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-resonance-border">
        <h3 className="text-sm font-semibold text-resonance-text-primary">Properties</h3>
        <button
          onClick={() => setSelectedNode(null)}
          className="p-1 rounded-lg hover:bg-resonance-bg-hover transition-colors"
        >
          <X size={14} className="text-resonance-text-muted" />
        </button>
      </div>

      {/* Block Info */}
      <div className="p-4 border-b border-resonance-border">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${data.color}15` }}
          >
            <IconComponent size={20} style={{ color: data.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={data.label}
              onChange={(e) => handleLabelChange(e.target.value)}
              className="text-sm font-semibold text-resonance-text-primary bg-transparent border-none focus:outline-none focus:ring-0 p-0 w-full"
            />
            <p className="text-xs text-resonance-text-muted capitalize">{data.type.replace(/-/g, ' ')}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => removeNode(selectedNode.id)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 text-xs font-medium hover:bg-red-500/20 transition-colors"
          >
            <Trash2 size={12} />
            Delete
          </button>
          <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-resonance-bg-tertiary text-resonance-text-secondary text-xs font-medium hover:bg-resonance-bg-hover transition-colors">
            <Copy size={12} />
            Duplicate
          </button>
        </div>
      </div>

      {/* Config Fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <h4 className="text-xs font-semibold text-resonance-text-secondary uppercase tracking-wider mb-3">
            Configuration
          </h4>
          {renderConfigFields()}
        </div>

        {/* Simulation Metrics (if available) */}
        {data.metrics && (
          <div className="mt-4 pt-4 border-t border-resonance-border">
            <h4 className="text-xs font-semibold text-resonance-text-secondary uppercase tracking-wider mb-3">
              Simulation Metrics
            </h4>
            <div className="space-y-2">
              <MetricRow label="Requests/sec" value={data.metrics.rps} />
              <MetricRow label="Latency" value={`${data.metrics.latency}ms`} />
              <MetricRow label="Errors" value={data.metrics.errors} color={data.metrics.errors > 10 ? 'text-red-500' : 'text-green-500'} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const MetricRow = ({ label, value, color = 'text-resonance-text-primary' }) => (
  <div className="flex items-center justify-between py-1">
    <span className="text-xs text-resonance-text-muted">{label}</span>
    <span className={`text-xs font-mono font-medium ${color}`}>{value}</span>
  </div>
)

const ConfigField = ({ label, value, onChange, type = 'text', options }) => {
  if (type === 'checkbox') {
    return (
      <div className="flex items-center justify-between py-2">
        <label className="text-sm text-resonance-text-secondary">{label}</label>
        <button
          onClick={() => onChange(!value)}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            value ? 'bg-resonance-accent' : 'bg-resonance-bg-tertiary border border-resonance-border'
          }`}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
              value ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
    )
  }

  if (options) {
    return (
      <div className="py-1.5">
        <label className="block text-xs text-resonance-text-muted mb-1">{label}</label>
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-1.5 bg-resonance-bg-tertiary border border-resonance-border rounded-lg text-sm text-resonance-text-primary focus:outline-none focus:ring-2 focus:ring-resonance-accent/30 focus:border-resonance-accent transition-all"
        >
          {options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <div className="py-1.5">
      <label className="block text-xs text-resonance-text-muted mb-1">{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-1.5 bg-resonance-bg-tertiary border border-resonance-border rounded-lg text-sm text-resonance-text-primary placeholder-resonance-text-muted focus:outline-none focus:ring-2 focus:ring-resonance-accent/30 focus:border-resonance-accent transition-all"
      />
    </div>
  )
}
