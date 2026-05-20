import {
  Globe, Server, Database, Zap, MessageSquare, Scale, Cloud, Monitor, ExternalLink, HardDrive,
  Activity, Cpu, Box, Network, Layers, Wifi, Smartphone, Link2, FolderOpen,
} from 'lucide-react'

// Map block type IDs to Lucide icon components
export const blockIconMap = {
  'api-gateway': Globe,
  'service': Server,
  'database': Database,
  'cache': Zap,
  'message-queue': MessageSquare,
  'load-balancer': Scale,
  'cdn': Cloud,
  'client': Monitor,
  'external-api': ExternalLink,
  'storage': HardDrive,
}

// Fallback icon
export const getBlockIcon = (iconName) => {
  return blockIconMap[iconName] || Server
}

// Map for the block library sidebar
export const libraryIconMap = {
  Globe, Server, Database, Zap, MessageSquare, Scale, Cloud, Monitor, ExternalLink, HardDrive,
}
