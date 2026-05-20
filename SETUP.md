# Setup Guide — Resonance

## Quick Start

### 1. Prerequisites

- **Node.js** 20+ (recommended: use [nvm](https://github.com/nvm-sh/nvm))
- **npm** 10+ or **yarn** 1.22+
- **Git**

### 2. Clone & Install

```bash
# Clone the repository
git clone <repo-url>
cd resonance

# Install all workspace dependencies
npm install
```

This installs dependencies for:
- `apps/web` — React frontend
- `apps/api` — Express backend
- `packages/shared` — Shared constants/types

### 3. Environment Setup

```bash
# Copy environment files
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env
```

Edit the `.env` files with your actual values (GitHub OAuth, etc.)

### 4. Start Development

```bash
# Start both frontend and backend concurrently
npm run dev
```

This starts:
- **Frontend** at http://localhost:5173
- **Backend** at http://localhost:3001

### 5. Individual Development

```bash
# Frontend only
cd apps/web
npm run dev

# Backend only
cd apps/api
npm run dev
```

## Project Structure

```
resonance/
├── apps/
│   ├── web/              # React 19 + Vite frontend
│   │   ├── src/
│   │   │   ├── components/   # Reusable UI & canvas components
│   │   │   ├── pages/        # Route-level pages
│   │   │   ├── stores/       # Zustand state management
│   │   │   ├── hooks/        # Custom React hooks
│   │   │   ├── lib/          # Utilities, animations, helpers
│   │   │   ├── services/     # API clients
│   │   │   ├── types/        # TypeScript-like type definitions
│   │   │   └── utils/        # Canvas rendering utilities (Phase 2)
│   │   ├── public/           # Static assets
│   │   ├── index.html
│   │   ├── vite.config.js
│   │   └── tailwind.config.js
│   └── api/              # Node.js + Express backend
│       └── src/
│           └── index.js
├── packages/
│   └── shared/           # Shared constants, block definitions
└── package.json          # Workspace root
```

## Available Scripts

### Root
| Command | Description |
|---------|-------------|
| `npm run dev` | Start both frontend and backend |
| `npm run build` | Build frontend for production |
| `npm run lint` | Lint all packages |

### Web (`apps/web`)
| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (port 5173) |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

### API (`apps/api`)
| Command | Description |
|---------|-------------|
| `npm run dev` | Start with auto-reload (port 3001) |
| `npm start` | Start production server |

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 19 | UI framework |
| Build Tool | Vite 6 | Fast dev & production builds |
| Routing | React Router 7 | SPA navigation |
| State | Zustand 5 | Lightweight state management |
| Canvas | @xyflow/react 12 | Node-based visual editor |
| Styling | Tailwind CSS 3 | Utility-first CSS |
| Animations | Anime.js 3 | Complex animations |
| Icons | Lucide React | Consistent icon set |
| Backend | Express 4 | REST API |

## Theming

Resonance supports **Dark**, **Light**, and **System** themes:

1. Toggle via the sun/moon icon in the header
2. Customize accent colors in **Settings > Appearance**
3. Themes are persisted to `localStorage`

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + S` | Save design |
| `Cmd/Ctrl + E` | Export design |
| `Cmd/Ctrl + K` | Show keyboard shortcuts |
| `Delete` | Delete selected block |
| `Space` | Run/Stop simulation |
| `+` / `-` | Zoom in/out |

## Troubleshooting

### Port already in use
```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
# Or change port in vite.config.js
```

### Module not found errors
```bash
# Clean install
rm -rf node_modules apps/*/node_modules packages/*/node_modules
rm package-lock.json apps/*/package-lock.json
npm install
```

### Anime.js not working
Make sure `animejs` is installed in `apps/web`:
```bash
cd apps/web
npm install animejs
```

## Next Steps

1. **Phase 1 (Current)**: Canvas editor, basic simulation, Docker export
2. **Phase 2**: Rust simulation engine, chaos testing, AI suggestions
3. **Phase 3**: Real-time collaboration, GitHub sync, drift detection
4. **Phase 4**: Custom blocks, plugin system, marketplace

See [README.md](README.md) for full architecture details.
