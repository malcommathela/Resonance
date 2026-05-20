import { BLOCK_TYPES } from '@shared/constants'

export const getBlockIcon = (iconName) => {
  // This will be used with dynamic imports from lucide-react
  return iconName
}

export const getBlockColor = (type) => {
  const block = BLOCK_TYPES.find(b => b.id === type)
  return block?.color || '#8b5cf6'
}

export const getBlockLabel = (type) => {
  const block = BLOCK_TYPES.find(b => b.id === type)
  return block?.label || type
}

export const getBlockCategory = (type) => {
  const block = BLOCK_TYPES.find(b => b.id === type)
  return block?.category || 'other'
}

export const categories = [
  { id: 'network', label: 'Network', color: '#8b5cf6' },
  { id: 'compute', label: 'Compute', color: '#3b82f6' },
  { id: 'data', label: 'Data', color: '#10b981' },
  { id: 'messaging', label: 'Messaging', color: '#ef4444' },
  { id: 'frontend', label: 'Frontend', color: '#6366f1' },
  { id: 'integration', label: 'Integration', color: '#84cc16' },
]
