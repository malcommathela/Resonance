# Resonance — Phase 1 Feature List

## ✅ Implemented

### Authentication
- [x] GitHub OAuth login (mock)
- [x] JWT token management
- [x] User profile with avatar
- [x] Logout functionality
- [x] Protected routes

### Dashboard
- [x] Design cards grid/list view
- [x] Search with debounce
- [x] Status filtering (All/Active/Draft)
- [x] Stats overview (total, active, simulations, team)
- [x] Create new design modal
- [x] Delete design with confirmation
- [x] Dropdown actions (Open, View, Duplicate, Delete)
- [x] Relative date formatting

### Canvas Editor
- [x] React Flow node-based canvas
- [x] 10 block types with icons & colors
- [x] Drag & drop from sidebar
- [x] Connect blocks with animated edges
- [x] Select blocks for properties
- [x] Delete blocks (Delete key or button)
- [x] Zoom controls + MiniMap
- [x] Dot grid background
- [x] Block entrance animations (Anime.js)

### Property Panel
- [x] Dynamic config fields per block type
- [x] Text inputs, number inputs, selects, toggles
- [x] Label editing
- [x] Block deletion
- [x] Simulation metrics display

### Simulation
- [x] Run/Stop simulation
- [x] Progress overlay
- [x] Steady traffic pattern
- [x] RPS slider (10-10,000)
- [x] Duration slider (30s-30min)
- [x] Live metrics (requests, latency, errors, throughput, availability)
- [x] Console logs
- [x] Metrics dashboard

### Export
- [x] Docker Compose generation
- [x] Code preview with syntax highlighting
- [x] Copy to clipboard
- [x] Download as file
- [x] Placeholder for K8s, Terraform, ADR (Phase 2)

### Settings
- [x] Profile editing (name, email, bio, avatar)
- [x] Appearance (Dark/Light/System themes)
- [x] Accent color picker (10 presets + custom)
- [x] Animation toggle
- [x] Notification preferences
- [x] Security (password, 2FA placeholder)
- [x] Billing tiers display (Free/Engineer/Team)
- [x] Integrations (GitHub, Slack, Notion placeholders)
- [x] Account deletion

### Theming
- [x] Dark mode (default)
- [x] Light mode
- [x] System preference
- [x] Custom accent colors
- [x] CSS custom properties
- [x] Persistent to localStorage
- [x] Smooth transitions

### UI/UX
- [x] Anime.js animations (fade, slide, scale, stagger)
- [x] Toast notifications system
- [x] Modal dialogs
- [x] Dropdown menus
- [x] Tooltips
- [x] Loading spinners
- [x] Keyboard shortcuts (⌘S, ⌘E, ⌘K, Delete, Space)
- [x] Responsive layout
- [x] Custom scrollbars
- [x] Glass morphism panels

### DevOps
- [x] Dockerfiles (web + API)
- [x] docker-compose.yml
- [x] nginx.conf
- [x] GitHub Actions CI/CD
- [x] ESLint config
- [x] Prettier config
- [x] .nvmrc

## 🚧 Phase 2 (Coming Soon)

- [ ] Rust simulation engine
- [ ] All traffic patterns (spike, ramp, flash sale, DDoS)
- [ ] Chaos engineering (kill instance, network partition, latency injection)
- [ ] AI optimization suggestions (OpenAI integration)
- [ ] Kubernetes export
- [ ] Terraform export
- [ ] ADR generation
- [ ] Real-time collaboration (WebSocket + CRDT)
- [ ] GitHub sync & drift detection
- [ ] Team collaboration
- [ ] Comments on canvas
- [ ] Version history
- [ ] Public API
