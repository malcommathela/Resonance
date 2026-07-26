import React, { useState, useMemo } from 'react'
import {
  Copy,
  Download,
  Check,
  FileJson,
  FileText,
  ChevronRight,
  Container,
  FileCode,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { DOCKER_COMPOSE_TEMPLATE } from '@shared/constants'

const EXPORT_FORMATS = [
  {
    id: 'docker',
    label: 'Docker Compose',
    icon: Container,
    description: 'Generate docker-compose.yml',
    extension: 'yml',
    mimeType: 'text/yaml',
  },
  {
    id: 'kubernetes',
    label: 'Kubernetes',
    icon: FileJson,
    description: 'Generate K8s manifests',
    extension: 'yaml',
    mimeType: 'text/yaml',
  },
  {
    id: 'terraform',
    label: 'Terraform',
    icon: FileCode,
    description: 'Generate Terraform HCL',
    extension: 'tf',
    mimeType: 'text/plain',
  },
  {
    id: 'adr',
    label: 'ADR',
    icon: FileText,
    description: 'Generate Architecture Decision Record',
    extension: 'md',
    mimeType: 'text/markdown',
  },
]

export const ExportModal = ({ isOpen, onClose, nodes, edges }) => {
  const [activeFormat, setActiveFormat] = useState('docker')
  const [copied, setCopied] = useState(false)

  const activeFormatDef = useMemo(
    () => EXPORT_FORMATS.find(f => f.id === activeFormat) || EXPORT_FORMATS[0],
    [activeFormat]
  )

  const generateDockerCompose = () => {
    const compose = DOCKER_COMPOSE_TEMPLATE(nodes, edges)
    return JSON.stringify(compose, null, 2)
  }

  const generateKubernetes = () => {
    const namespace = 'resonance-app'
    let yaml = `apiVersion: v1\nkind: Namespace\nmetadata:\n  name: ${namespace}\n\n`

    nodes.forEach((node, idx) => {
      const type = node.data?.type || node.type
      const name = (node.data?.label || `${type}-${idx}`).toLowerCase().replace(/[^a-z0-9]+/g, '-')
      const config = node.data?.config || {}

      yaml += `---\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: ${name}\n  namespace: ${namespace}\nspec:\n  replicas: ${config.replicas || 1}\n  selector:\n    matchLabels:\n      app: ${name}\n  template:\n    metadata:\n      labels:\n        app: ${name}\n    spec:\n      containers:\n      - name: ${name}\n        image: ${getImageForType(type)}\n        ports:\n        - containerPort: ${config.port || 80}\n`
      if (config.memory) {
        yaml += `        resources:\n          limits:\n            memory: ${config.memory}\n`
      }
      yaml += `---\napiVersion: v1\nkind: Service\nmetadata:\n  name: ${name}-svc\n  namespace: ${namespace}\nspec:\n  selector:\n    app: ${name}\n  ports:\n  - port: ${config.port || 80}\n    targetPort: ${config.port || 80}\n\n`
    })

    return yaml
  }

  const generateTerraform = () => {
    let hcl = `terraform {\n  required_providers {\n    aws = {\n      source  = "hashicorp/aws"\n      version = "~> 5.0"\n    }\n  }\n}\n\n`
    hcl += `provider "aws" {\n  region = "us-east-1"\n}\n\n`

    nodes.forEach((node, idx) => {
      const type = node.data?.type || node.type
      const name = (node.data?.label || `${type}-${idx}`).toLowerCase().replace(/[^a-z0-9]+/g, '-')
      const config = node.data?.config || {}

      if (type === 'service' || type === 'api-gateway') {
        hcl += `resource "aws_ecs_service" "${name}" {\n  name            = "${name}"\n  cluster         = aws_ecs_cluster.main.id\n  task_definition = aws_ecs_task_definition.${name}.arn\n  desired_count   = ${config.replicas || 1}\n}\n\n`
      }
      if (type === 'database') {
        hcl += `resource "aws_db_instance" "${name}" {\n  identifier     = "${name}"\n  engine         = "${config.engine || 'postgres'}"\n  instance_class = "db.t3.micro"\n  allocated_storage = 20\n}\n\n`
      }
      if (type === 'cache') {
        hcl += `resource "aws_elasticache_cluster" "${name}" {\n  cluster_id      = "${name}"\n  engine          = "${config.engine || 'redis'}"\n  node_type       = "cache.t3.micro"\n  num_cache_nodes = 1\n}\n\n`
      }
    })

    return hcl
  }

  const generateAdr = () => {
    const designName = nodes.length > 0 ? 'System Architecture' : 'Untitled Design'
    const date = new Date().toISOString().split('T')[0]

    let md = `# ADR-001: ${designName}\n\n## Status\nAccepted\n\n## Context\nArchitecture design generated from Resonance on ${date}.\n\n## Components\n\n`

    nodes.forEach((node, idx) => {
      const type = node.data?.type || node.type
      const label = node.data?.label || type
      md += `### ${idx + 1}. ${label} (${type})\n`
      md += `- **Category:** ${node.data?.category || 'unknown'}\n`
      if (node.data?.config && Object.keys(node.data.config).length > 0) {
        md += `- **Configuration:**\n`
        Object.entries(node.data.config).forEach(([key, val]) => {
          md += `  - ${key}: ${val}\n`
        })
      }
      md += `\n`
    })

    md += `## Connections\n\n`
    edges.forEach((edge, idx) => {
      const source = nodes.find(n => n.id === edge.source)?.data?.label || edge.source
      const target = nodes.find(n => n.id === edge.target)?.data?.label || edge.target
      const connType = edge.data?.connectionType || 'http'
      md += `${idx + 1}. **${source}** → **${target}** (${connType.toUpperCase()})\n`
    })

    md += `\n## Decision\nThis architecture was designed and simulated using Resonance.\n\n## Consequences\n- Scalable and maintainable microservices architecture\n- Containerized deployment ready\n`

    return md
  }

  const getExportContent = () => {
    switch (activeFormat) {
      case 'docker': return generateDockerCompose()
      case 'kubernetes': return generateKubernetes()
      case 'terraform': return generateTerraform()
      case 'adr': return generateAdr()
      default: return ''
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(getExportContent())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const content = getExportContent()
    const blob = new Blob([content], { type: activeFormatDef.mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `resonance-export.${activeFormatDef.extension}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const content = getExportContent()

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Export Design"
      size="xl"
    >
      <div className="flex gap-6 h-[500px]">
        <div className="w-64 shrink-0 space-y-2">
          {EXPORT_FORMATS.map(format => {
            const Icon = format.icon
            const isActive = activeFormat === format.id

            return (
              <button
                key={format.id}
                onClick={() => setActiveFormat(format.id)}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border transition-all text-left ${
                  isActive
                    ? 'border-resonance-accent bg-resonance-accent/5'
                    : 'border-resonance-border hover:border-resonance-accent/30 hover:bg-resonance-bg-hover'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  isActive ? 'bg-resonance-accent/10' : 'bg-resonance-bg-tertiary'
                }`}>
                  <Icon size={20} className={isActive ? 'text-resonance-accent' : 'text-resonance-text-muted'} />
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${isActive ? 'text-resonance-accent' : 'text-resonance-text-primary'}`}>
                    {format.label}
                  </p>
                  <p className="text-xs text-resonance-text-muted mt-0.5">{format.description}</p>
                </div>
                <ChevronRight size={16} className={`ml-auto shrink-0 ${isActive ? 'text-resonance-accent' : 'text-resonance-text-muted'}`} />
              </button>
            )
          })}
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-resonance-text-secondary">
              Preview — {activeFormatDef.label}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={copied ? Check : Copy}
                onClick={handleCopy}
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button
                size="sm"
                icon={Download}
                onClick={handleDownload}
              >
                Download
              </Button>
            </div>
          </div>
          <div className="flex-1 bg-resonance-bg-tertiary border border-resonance-border rounded-xl overflow-hidden">
            <pre className="h-full overflow-auto p-4 text-xs font-mono text-resonance-text-secondary">
              <code>{content}</code>
            </pre>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function getImageForType(type) {
  const imageMap = {
    'api-gateway': 'nginx:alpine',
    'service': 'node:18-alpine',
    'database': 'postgres:15-alpine',
    'cache': 'redis:7-alpine',
    'message-queue': 'confluentinc/cp-kafka:latest',
    'load-balancer': 'nginx:alpine',
    'cdn': 'nginx:alpine',
    'client': 'nginx:alpine',
    'external-api': 'nginx:alpine',
    'storage': 'minio/minio:latest',
  }
  return imageMap[type] || 'alpine:latest'
}