import { useState, useEffect } from 'react'
import { useDesignStore } from '@/stores/designStore'

export const useDesign = (id) => {
  const { getDesignById } = useDesignStore()
  const [design, setDesign] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      const d = getDesignById(id)
      setDesign(d)
      setLoading(false)
    }
  }, [id, getDesignById])

  return { design, loading }
}
