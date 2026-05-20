import { DOCKER_COMPOSE_TEMPLATE } from '@shared/constants'

export const exportToDockerCompose = (nodes, edges) => {
  const compose = DOCKER_COMPOSE_TEMPLATE(nodes, edges)
  return JSON.stringify(compose, null, 2)
}

export const downloadFile = (content, filename, type = 'text/yaml') => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
