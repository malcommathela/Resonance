// Property resolver (Phase 5): the only path between the inspector and raw
// node data. The panel never guesses whether a property lives at
// `config.replicas` or `behavioralModel.scalingBehavior.maxReplicas` — the
// definition's path decides. Unknown config keys are reported (never deleted)
// for the Advanced/Legacy bucket.
// Dependency-free: covered by property.check.js (run: node property.check.js).
import { PROPERTY_DEFINITIONS, getPropertyDefinition } from './propertyDefinitions.js'

// Read root: definitions address node.data paths; behavioralModel defs resolve
// under data.config.behavioralModel.
function readRoot(node, def) {
  if (def.path[0] === 'behavioralModel') return node?.data?.config?.behavioralModel
  if (def.path[0] === 'config') return node?.data?.config
  return node?.data
}

function readPath(def) {
  return def.path[0] === 'behavioralModel' || def.path[0] === 'config' ? def.path.slice(1) : def.path
}

export function getPropertyValue(node, id) {
  const def = typeof id === 'string' ? getPropertyDefinition(id) : id
  if (!def) return undefined
  let cur = readRoot(node, def)
  for (const key of readPath(def)) {
    if (cur == null) return undefined
    cur = cur[key]
  }
  return cur
}

export function isPropertyVisible(node, id) {
  const def = typeof id === 'string' ? getPropertyDefinition(id) : id
  if (!def) return false
  return typeof def.visible === 'function' ? def.visible(node) : true
}

// Returns an updateNode-compatible patch: { label } for presentation,
// { config } otherwise (behavioralModel merged under config). Pure.
export function setPropertyValue(node, id, value) {
  const def = typeof id === 'string' ? getPropertyDefinition(id) : id
  if (!def) return {}
  const [head, ...rest] = def.path
  if (head !== 'config' && head !== 'behavioralModel') return { [head]: value }
  const config = { ...(node?.data?.config || {}) }
  if (head === 'config') {
    config[rest[0]] = value
    return { config }
  }
  const section = rest[0]
  const key = rest[1]
  return {
    config: {
      ...config,
      behavioralModel: {
        ...(config.behavioralModel || {}),
        [section]: { ...(config.behavioralModel?.[section] || {}), [key]: value },
      },
    },
  }
}

// Panel seam helpers: section/key writes resolve through the registry first,
// falling back to the generic merge for unregistered paths. Unknown data is
// never dropped — updateNode deep-merges behavioralModel.
export function setBehavioralValue(node, section, key, value) {
  const def = PROPERTY_DEFINITIONS.find(
    (d) => d.path[0] === 'behavioralModel' && d.path[1] === section && d.path[2] === key,
  )
  if (def) return setPropertyValue(node, def, value)
  const config = { ...(node?.data?.config || {}) }
  return {
    config: {
      ...config,
      behavioralModel: {
        ...(config.behavioralModel || {}),
        [section]: { ...(config.behavioralModel?.[section] || {}), [key]: value },
      },
    },
  }
}

export function setConfigValue(node, key, value) {
  const def = PROPERTY_DEFINITIONS.find((d) => d.path[0] === 'config' && d.path[1] === key)
  if (def) return setPropertyValue(node, def, value)
  return { config: { ...(node?.data?.config || {}), [key]: value } }
}

// Config keys no definition claims (excluding behavioralModel itself):
// rendered as Advanced/Legacy, preserved verbatim.
export function unknownConfigKeys(node) {
  const config = node?.data?.config || {}
  const known = new Set(
    PROPERTY_DEFINITIONS.filter((d) => d.path[0] === 'config').map((d) => d.path[1]),
  )
  return Object.keys(config).filter((k) => k !== 'behavioralModel' && !known.has(k))
}
