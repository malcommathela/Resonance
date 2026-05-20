import { useState, useCallback } from 'react'
import { useCanvasStore } from '@/stores/canvasStore'

export const useSimulation = () => {
  const { simulationRunning, startSimulation, stopSimulation } = useCanvasStore()
  const [progress, setProgress] = useState(0)

  const run = useCallback(() => {
    if (simulationRunning) {
      stopSimulation()
      setProgress(0)
      return
    }

    startSimulation()
    let p = 0
    const interval = setInterval(() => {
      p += 5
      setProgress(p)
      if (p >= 100) {
        clearInterval(interval)
        stopSimulation()
        setProgress(0)
      }
    }, 150)
  }, [simulationRunning, startSimulation, stopSimulation])

  return { run, progress, isRunning: simulationRunning }
}
