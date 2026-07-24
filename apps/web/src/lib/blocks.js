// Re-export everything from shared constants so consumers only need one import
export {
  BLOCK_TYPES,
  categories,
  CONNECTION_TYPES,
  CONNECTION_TYPE_META,
  TRAFFIC_PATTERNS,
  SCENARIOS,
  GROWTH_SCENARIOS,
  THEMES,
  DOCKER_COMPOSE_TEMPLATE,
  SIMULATION_BLOCK_TYPES,
  SIMULATION_CONNECTION_TYPES,
  getBlockBehavioralModel,
  getConnectionBehavioralModel,
  mergeBlockBehavioralModel,
  mergeConnectionBehavioralModel,
  getSupportedBlockTypes,
  getSupportedConnectionTypes,
  isBlockTypeSupported,
  isConnectionTypeSupported,
} from '@shared/constants'

// UI helpers
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

export const getBlockDescription = (type) => {
  const block = BLOCK_TYPES.find(b => b.id === type)
  return block?.description || ''
}

export const getConnectionMeta = (connectionType) => {
  return CONNECTION_TYPE_META[connectionType] || CONNECTION_TYPE_META['http']
}

export const getTrafficPatternMeta = (patternId) => {
  return TRAFFIC_PATTERNS.find(p => p.id === patternId) || TRAFFIC_PATTERNS[0]
}

export const getScenarioMeta = (scenarioId) => {
  return SCENARIOS.find(s => s.id === scenarioId) || SCENARIOS[0]
}

export const getGrowthScenarioMeta = (growthId) => {
  return GROWTH_SCENARIOS.find(g => g.id === growthId) || null
}