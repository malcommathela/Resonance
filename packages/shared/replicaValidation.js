// Shared replica contract (Phase 3). Pure, dependency-free.
// Canonical read: flat config.replicas + config.behavioralModel.scalingBehavior
// bounds (flat wins when both are set). Client preflight and API/simulation
// validation share this — never re-implement the bounds math per call site.
// Covered by replicaValidation.check.js (run: node replicaValidation.check.js).
export function extractReplicaConfig(config) {
  const scaling = config?.behavioralModel?.scalingBehavior || {}
  return {
    replicas: config?.replicas,
    minReplicas: config?.minReplicas ?? scaling.minReplicas,
    maxReplicas: config?.maxReplicas ?? scaling.maxReplicas,
    autoscaling: config?.autoScaling === true,
  }
}

// Returns plain issues; callers map them to their own finding shapes.
// Never clamps or mutates user input — invalid config is reported, not fixed.
// ponytail: O(1) scalar checks; no per-block-type table until a type needs one
export function validateReplicaConfig(input) {
  const { replicas, minReplicas, maxReplicas, autoscaling } = input || {}
  const issues = []
  const isInt = (v) => Number.isInteger(v)
  if (replicas !== undefined && (!isInt(replicas) || replicas < 1)) {
    issues.push({ code: 'replicas', property: 'replicas', currentValue: replicas, message: `Invalid replicas: ${replicas}. Must be an integer >= 1.` })
  }
  if (minReplicas !== undefined && (!isInt(minReplicas) || minReplicas < 1)) {
    issues.push({ code: 'minReplicas', property: 'minReplicas', currentValue: minReplicas, message: `Invalid minReplicas: ${minReplicas}. Must be an integer >= 1.` })
  }
  if (maxReplicas !== undefined && (!isInt(maxReplicas) || maxReplicas < 1)) {
    issues.push({ code: 'maxReplicas', property: 'maxReplicas', currentValue: maxReplicas, message: `Invalid maxReplicas: ${maxReplicas}. Must be an integer >= 1.` })
  }
  if (isInt(minReplicas) && minReplicas >= 1 && isInt(maxReplicas) && maxReplicas >= 1 && maxReplicas < minReplicas) {
    issues.push({ code: 'range', property: 'maxReplicas', currentValue: maxReplicas, message: `maxReplicas (${maxReplicas}) < minReplicas (${minReplicas}).` })
  }
  if (autoscaling === true) {
    if (minReplicas === undefined || maxReplicas === undefined) {
      issues.push({ code: 'autoscaling', property: 'autoScaling', currentValue: true, message: 'autoScaling is enabled but minReplicas or maxReplicas is missing.' })
    } else if (isInt(replicas) && replicas >= 1 && isInt(minReplicas) && isInt(maxReplicas) && (replicas < minReplicas || replicas > maxReplicas)) {
      issues.push({ code: 'bounds', property: 'replicas', currentValue: replicas, message: `replicas (${replicas}) is outside autoscaling bounds [${minReplicas}, ${maxReplicas}].` })
    }
  }
  return issues
}
