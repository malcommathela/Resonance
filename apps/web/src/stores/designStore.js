import { create } from 'zustand'

const mockDesigns = [
  {
    id: 'des_1',
    name: 'E-Commerce Platform',
    description: 'Microservices architecture for online store',
    status: 'active',
    repoUrl: 'https://github.com/example/ecommerce',
    repoBranch: 'main',
    createdAt: '2026-05-15T10:30:00Z',
    updatedAt: '2026-05-19T14:22:00Z',
    blocks: 8,
    simulations: 12,
    thumbnail: null,
  },
  {
    id: 'des_2',
    name: 'Chat Application',
    description: 'Real-time messaging with WebSockets',
    status: 'draft',
    repoUrl: null,
    repoBranch: null,
    createdAt: '2026-05-18T09:15:00Z',
    updatedAt: '2026-05-18T09:15:00Z',
    blocks: 5,
    simulations: 0,
    thumbnail: null,
  },
  {
    id: 'des_3',
    name: 'Video Streaming',
    description: 'CDN-backed video delivery system',
    status: 'active',
    repoUrl: 'https://github.com/example/streaming',
    repoBranch: 'develop',
    createdAt: '2026-05-10T16:45:00Z',
    updatedAt: '2026-05-17T11:30:00Z',
    blocks: 6,
    simulations: 3,
    thumbnail: null,
  },
]

export const useDesignStore = create((set, get) => ({
  designs: mockDesigns,
  currentDesign: null,
  isLoading: false,

  createDesign: (design) => {
    const newDesign = {
      id: 'des_' + Math.random().toString(36).substr(2, 9),
      ...design,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      blocks: 0,
      simulations: 0,
    }
    set({ designs: [newDesign, ...get().designs] })
    return newDesign
  },

  updateDesign: (id, updates) => {
    set({
      designs: get().designs.map(d =>
        d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d
      )
    })
  },

  deleteDesign: (id) => {
    set({ designs: get().designs.filter(d => d.id !== id) })
  },

  setCurrentDesign: (design) => set({ currentDesign: design }),

  getDesignById: (id) => get().designs.find(d => d.id === id),
}))
