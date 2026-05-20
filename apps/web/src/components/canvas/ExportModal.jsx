import React, { useState } from 'react'
import {
  FileCode,
  Copy,
  Download,
  Check,
  FileJson,
  FileText,
  ChevronRight,
  Container,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { DOCKER_COMPOSE_TEMPLATE } from '@shared/constants'

export const ExportModal = ({ isOpen, onClose, nodes, edges }) => {
  const [activeFormat, setActiveFormat] = useState('docker')
  const [copied, setCopied] = useState(false)

  const formats = [
    {
      id: 'docker',
      label: 'Docker Compose',
      icon: Container,  // <-- fixed here
      description: 'Generate docker-compose.yml'
    },
    { id: 'kubernetes', label: 'Kubernetes', icon: FileJson, description: 'Generate K8s manifests (Phase 2)' },
    { id: 'terraform', label: 'Terraform', icon: FileCode, description: 'Generate Terraform HCL (Phase 2)' },
    { id: 'adr', label: 'ADR', icon: FileText, description: 'Generate Architecture Decision Record (Phase 2)' },
  ]

  const generateDockerCompose = () => {
    const compose = DOCKER_COMPOSE_TEMPLATE(nodes, edges)
    // Simple YAML-like formatting without external dependency
    let yaml = `version: '3.8'\n\n`
    yaml += `services:\n`

    Object.entries(compose.services).forEach(([name, service]) => {
      yaml += `  ${name}:\n`
      if (service.image) yaml += `    image: ${service.image}\n`
      if (service.ports) {
        yaml += `    ports:\n`
        service.ports.forEach(port => {
          yaml += `      - "${port}"\n`
        })
      }
      if (service.environment) {
        yaml += `    environment:\n`
        Object.entries(service.environment).forEach(([key, val]) => {
          yaml += `      - ${key}=${val}\n`
        })
      }
      if (service.volumes) {
        yaml += `    volumes:\n`
        service.volumes.forEach(vol => {
          yaml += `      - ${vol}\n`
        })
      }
      if (service.depends_on) {
        yaml += `    depends_on:\n`
        service.depends_on.forEach(dep => {
          yaml += `      - ${dep}\n`
        })
      }
      if (service.command) {
        yaml += `    command: ${service.command}\n`
      }
      yaml += `\n`
    })

    yaml += `networks:\n`
    yaml += `  app-network:\n`
    yaml += `    driver: bridge\n\n`

    if (Object.keys(compose.volumes).length > 0) {
      yaml += `volumes:\n`
      Object.keys(compose.volumes).forEach(vol => {
        yaml += `  ${vol}:\n`
      })
    }

    return yaml
  }

  const getExportContent = () => {
    switch (activeFormat) {
      case 'docker':
        return generateDockerCompose()
      case 'kubernetes':
        return `# Kubernetes manifests
# Coming in Phase 2

apiVersion: v1
kind: Namespace
metadata:
  name: resonance-app`
      case 'terraform':
        return `# Terraform Configuration
# Coming in Phase 2

terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
  }
}`
      case 'adr':
        return `# ADR-001: System Architecture

## Status
Draft

## Context
System design generated from Resonance

## Decision
- Microservices architecture
- Containerized deployment

## Consequences
- Scalable and maintainable`
      default:
        return ''
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(getExportContent())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const content = getExportContent()
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = activeFormat === 'docker' ? 'docker-compose.yml' :
                 activeFormat === 'kubernetes' ? 'k8s-manifests.yaml' :
                 activeFormat === 'terraform' ? 'main.tf' : 'adr-001.md'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Export Design"
      size="xl"
    >
      <div className="flex gap-6 h-[500px]">
        {/* Format Selection */}
        <div className="w-64 shrink-0 space-y-2">
          {formats.map(format => {
            const Icon = format.icon
            const isActive = activeFormat === format.id
            const isDisabled = format.id !== 'docker'

            return (
              <button
                key={format.id}
                onClick={() => !isDisabled && setActiveFormat(format.id)}
                disabled={isDisabled}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border transition-all text-left ${
                  isActive
                    ? 'border-resonance-accent bg-resonance-accent/5'
                    : isDisabled
                    ? 'border-resonance-border opacity-50 cursor-not-allowed'
                    : 'border-resonance-border hover:border-resonance-accent/30 hover:bg-resonance-bg-hover'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  isActive ? 'bg-resonance-accent/10' : 'bg-resonance-bg-tertiary'
                }`}>
                  <Icon size={20} className={isActive ? 'text-resonance-accent' : 'text-resonance-text-muted'} />
                </div>
                <div>
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

        {/* Preview */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-resonance-text-secondary">
              Preview — {formats.find(f => f.id === activeFormat)?.label}
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
              <code>{getExportContent()}</code>
            </pre>
          </div>
        </div>
      </div>
    </Modal>
  )
}
