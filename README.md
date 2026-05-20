# Resonance — System Design Simulator

A visual system design simulator that connects to GitHub repositories, reverse-engineers architecture, and enables real-time simulation with AI-powered optimization suggestions.

## Phase 1 (MVP) Features

- **Visual Canvas Editor** — Drag-and-drop node-based system design with React Flow
- **10 Block Types** — API Gateway, Service, Database, Cache, Message Queue, Load Balancer, CDN, Client, External API, Storage
- **Basic Simulation** — Steady traffic pattern with live metrics
- **GitHub OAuth** — Authentication with GitHub (mock for MVP)
- **Docker Compose Export** — Generate production-ready docker-compose.yml
- **Dark/Light Themes** — Full theme system with customizable accent colors
- **Settings** — Profile, appearance, notifications, security, billing, integrations

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite |
| Routing | React Router v7 |
| State | Zustand |
| Canvas | @xyflow/react (React Flow) |
| Styling | Tailwind CSS v3 |
| Animations | Anime.js |
| Icons | Lucide React |
| Backend | Node.js + Express |

## Project Structure

```
resonance/
├── apps/
│   ├── web/          # React + Vite frontend
│   │   ├── src/
│   │   │   ├── pages/         # Login, Dashboard, CanvasEditor, Settings
│   │   │   ├── components/    # Canvas, Layout, UI components
│   │   │   ├── stores/        # Zustand stores
│   │   │   ├── hooks/         # Custom React hooks
│   │   │   ├── lib/           # Utilities, animations, blocks
│   │   │   └── services/      # API clients
│   │   ├── index.html
│   │   ├── vite.config.js
│   │   └── tailwind.config.js
│   └── api/          # Node.js + Express backend
│       └── src/
│           └── index.js
├── packages/
│   └── shared/       # Shared constants, types
└── package.json      # Workspace root
```

## Getting Started

### Prerequisites
- Node.js 20+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd resonance

# Install dependencies
npm install

# Start both frontend and backend
npm run dev
```

This will start:
- **Frontend** at http://localhost:5173
- **Backend** at http://localhost:3001

### Individual Commands

```bash
# Frontend only
cd apps/web
npm run dev

# Backend only
cd apps/api
npm run dev

# Build frontend
cd apps/web
npm run build
```

## Pages

| Page | Route | Description |
|------|-------|-------------|
| Login | `/login` | GitHub OAuth, split-screen layout |
| Dashboard | `/dashboard` | Designs list, stats, create new |
| Canvas Editor | `/design/:id` | Node-based editor, simulation, export |
| Settings | `/settings` | Profile, appearance, billing |

## Canvas Editor Features

- **Drag & Drop** — Drag blocks from left sidebar onto canvas
- **Connect** — Click and drag from block handles to create connections
- **Configure** — Select a block to edit properties in right panel
- **Simulate** — Click "Run" to start a simulation with live metrics
- **Export** — Generate Docker Compose from your design

## Theming

Resonance supports three themes:
- **Dark** (default) — Deep dark with purple accents
- **Light** — Clean light with customizable accents
- **System** — Follows OS preference

Accent colors are fully customizable via Settings > Appearance.

## Development Phases

| Phase | Timeline | Features |
|-------|----------|----------|
| Phase 1 (MVP) | Months 1-3 | Canvas, 10 blocks, steady simulation, GitHub OAuth, Docker export |
| Phase 2 | Months 4-6 | Full Rust simulation engine, chaos mode, AI suggestions, K8s/Terraform export |
| Phase 3 | Months 7-9 | Real-time collaboration (CRDT), GitHub sync, drift detection |
| Phase 4 | Months 10-12 | Custom blocks, plugin system, marketplace, on-prem option |

## License

MIT
