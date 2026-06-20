import { BLOCK_TYPES, categories, CONNECTION_TYPES, CONNECTION_TYPE_META } from '@shared/constants'

export { BLOCK_TYPES, categories, CONNECTION_TYPES, CONNECTION_TYPE_META }

export const getBlockIcon = (iconName) => {
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