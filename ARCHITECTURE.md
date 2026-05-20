# Resonance — Frontend Architecture

## Page Flow

```
┌─────────┐     ┌─────────────┐     ┌─────────────┐
│  Login  │────▶│  Dashboard  │────▶│ Design Card │
│  /login │     │  /dashboard │     │   (click)   │
└─────────┘     └─────────────┘     └──────┬──────┘
      ▲                                      │
      │                                      ▼
      │                              ┌─────────────┐
      │                              │    Canvas   │
      │                              │  /design/:id│
      │                              └──────┬──────┘
      │                                     │
      │         ┌─────────────┐             │
      └─────────│  Settings   │◀────────────┘
                │  /settings  │
                └─────────────┘
```

## Component Hierarchy

```
App
├── Routes
│   ├── Login (public)
│   ├── AppShell (protected)
│   │   ├── Header
│   │   │   ├── Search
│   │   │   ├── ThemeToggle
│   │   │   └── UserMenu
│   │   ├── Sidebar
│   │   │   ├── NavItems
│   │   │   └── NewDesignButton
│   │   └── Outlet
│   │       ├── Dashboard
│   │       │   ├── StatsCards
│   │       │   ├── Toolbar (search, filter, view)
│   │       │   └── DesignGrid/List
│   │       ├── DesignDetail
│   │       │   ├── Header
│   │       │   ├── Stats
│   │       │   └── Activity
│   │       └── Settings
│   │           ├── Profile
│   │           ├── Appearance
│   │           ├── Notifications
│   │           ├── Security
│   │           ├── Billing
│   │           └── Integrations
│   ├── CanvasEditor (protected, full-screen)
│   │   ├── TopToolbar
│   │   │   ├── Tabs (Editor/Simulation/Export)
│   │   │   ├── SimulationControls
│   │   │   └── Actions (Save, Export, Share)
│   │   ├── BlockLibrary (left sidebar)
│   │   ├── ReactFlow Canvas (center)
│   │   │   ├── CustomBlockNode
│   │   │   ├── Background (dots)
│   │   │   ├── Controls
│   │   │   └── MiniMap
│   │   ├── PropertyPanel (right sidebar)
│   │   │   ├── BlockInfo
│   │   │   └── ConfigFields
│   │   ├── BottomPanel
│   │   │   ├── Console (logs)
│   │   │   └── Metrics
│   │   └── Modals
│   │       ├── ExportModal
│   │       ├── ShareModal
│   │       └── KeyboardShortcuts
│   └── NotFound
└── ToastProvider (global)
```

## State Management

```
Zustand Stores
├── authStore
│   ├── user
│   ├── isAuthenticated
│   ├── login()
│   └── logout()
├── designStore
│   ├── designs[]
│   ├── currentDesign
│   ├── createDesign()
│   ├── updateDesign()
│   └── deleteDesign()
├── canvasStore
│   ├── nodes[]
│   ├── edges[]
│   ├── selectedNode
│   ├── simulationRunning
│   ├── simulationMetrics
│   ├── addNode()
│   ├── updateNode()
│   ├── removeNode()
│   ├── startSimulation()
│   └── stopSimulation()
└── themeStore
    ├── theme (dark/light/system)
    ├── accentColor
    ├── animationsEnabled
    ├── setTheme()
    ├── setAccentColor()
    └── applyTheme()
```

## Animation System

```
anime.js Wrappers
├── fadeInUp      → Page entrances
├── fadeIn        → Modals, overlays
├── scaleIn       → Buttons, cards
├── slideInLeft   → Sidebars
├── slideInRight  → Panels
├── staggerFadeIn → Lists, grids
├── pulse         → Interactive feedback
├── shake         → Error states
├── glow          → Active elements
├── countUp       → Metric numbers
├── blockEnter    → Canvas blocks
├── drawLine      → Connections
├── simPulse      → Running simulations
├── float         → Decorative elements
├── gradientShift → Backgrounds
├── modalEnter    → Modal content
└── backdropFade  → Modal backdrops
```

## Theme System

```
CSS Custom Properties
├── --bg-primary       → Main background
├── --bg-secondary     → Card/sidebar bg
├── --bg-tertiary      → Input bg
├── --bg-elevated      → Modal/popover bg
├── --bg-hover         → Hover states
├── --text-primary     → Headings
├── --text-secondary   → Body text
├── --text-muted       → Labels/hints
├── --border-color     → All borders
├── --accent           → Primary brand color
├── --accent-hover     → Hover accent
├── --success          → Success states
├── --warning          → Warning states
├── --error            → Error states
├── --canvas-bg        → Canvas background
├── --canvas-grid      → Grid dots
├── --sidebar-bg       → Sidebar background
└── --panel-bg         → Panel background
```
