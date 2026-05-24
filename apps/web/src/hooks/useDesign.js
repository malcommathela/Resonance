import { useState, useEffect } from 'react'
import { useDesignStore } from '@/stores/designStore'

export const useDesign = (id) => {
  const { loadDesign, currentDesign } = useDesignStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      setLoading(true)
      loadDesign(id).finally(() => setLoading(false))
    }
  }, [id, loadDesign])

  return { design: currentDesign, loading }
}