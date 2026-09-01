# Resonance — System Design Simulator

A visual system design simulator that connects to GitHub repositories, reverse-engineers architecture, and runs real-time Monte Carlo simulations with AI-powered analysis and optimization suggestions.

## Features

* **Visual Canvas Editor** — Drag-and-drop node-based system design with React Flow
* **Architecture Blocks** — API Gateway, Service, Database, Cache, Message Queue, Load Balancer, CDN, Client, External API, Storage, and more
* **GitHub Integration** — OAuth sign-in, repository import, and architecture reverse-engineering
* **Real-Time Simulation** — Monte Carlo simulations with live SSE progress, traffic curves, failure injection, and growth scenarios
* **Simulation Reports** — Persistent reports containing reliability, scalability, cost, performance, and security analysis
* **AI-Powered Analysis** — AI-generated architecture insights and optimization suggestions using Google Gemini
* **Team Collaboration** — Create teams, invite members by email, and manage role-based access
* **Design Management** — Manage personal and team designs with versioned simulation history
* **Audit Logging** — Append-only audit logs for security, compliance, and debugging
* **Dark/Light/System Themes** — Fully customizable appearance and accent colors
* **Settings** — Profile, appearance, notifications, security, billing, and integrations

## Tech Stack

| Layer            | Technology                 |
| ---------------- | -------------------------- |
| Frontend         | React 19 + Vite            |
| Routing          | React Router v7            |
| State Management | Zustand                    |
| Authentication   | Clerk                      |
| Canvas           | @xyflow/react (React Flow) |
| Styling          | Tailwind CSS v3            |
| Animations       | Anime.js                   |
| Icons            | Lucide React               |
| Backend          | Node.js + Express          |
| ORM              | Prisma                     |
| Database         | PostgreSQL                 |
| Cache / PubSub   | Redis                      |
| Job Queue        | BullMQ                     |
| Email            | Nodemailer + SMTP          |
| AI               | Google Gemini              |
| Monorepo         | Turborepo                  |

## Getting Started

### Prerequisites

* Node.js 20+
* npm
* Docker and Docker Compose
* A Clerk application
* PostgreSQL
* Redis
* SMTP credentials for team invitations
* Google Gemini API key

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd resonance

# Install dependencies
npm install
```

### Environment Setup

Create the environment files:

```bash
# Backend
cp apps/api/.env.example apps/api/.env

# Frontend
cp apps/web/.env.example apps/web/.env
```

Configure the required environment variables.

### Backend Environment

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/resonance?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/resonance?schema=public"

REDIS_URL="redis://localhost:6379"

JWT_SECRET="your-jwt-secret"

CLERK_SECRET_KEY="sk_..."
CLERK_WEBHOOK_SECRET="whsec_..."

# SMTP
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="noreply@resonance.com"

FRONTEND_URL="http://localhost:5173"

# AI
GEMINI_API_KEY="your-gemini-api-key"
```

### Frontend Environment

```env
VITE_CLERK_PUBLISHABLE_KEY="pk_..."
```

> Never commit `.env` files or expose secret keys in the frontend.

## Database & Redis

Start the local PostgreSQL and Redis services:

```bash
docker-compose up -d
```

Run Prisma migrations and generate the Prisma client:

```bash
cd apps/api

npx prisma migrate dev
npx prisma generate
```

## Development

Start the complete development environment:

```bash
npm run dev
```

The application includes:

* **Frontend:** `http://localhost:5173`
* **Backend:** `http://localhost:3001`
* **PostgreSQL:** `localhost:5432`
* **Redis:** `localhost:6379`

### Run Services Individually

Frontend:

```bash
cd apps/web
npm run dev
```

Backend:

```bash
cd apps/api
npm run dev
```

Simulation worker:

```bash
cd apps/api
npm run worker
```

## Simulation Engine

Resonance uses a background simulation pipeline powered by BullMQ and Redis.

The simulation engine supports:

### Traffic Patterns

* Steady traffic
* Bursty traffic
* Spiky traffic
* Seasonal traffic
* Randomized traffic
* Custom traffic curves

### Monte Carlo Simulation

Simulation runs can use configurable Monte Carlo passes from **1 to 1000**.

Results can include:

* Confidence intervals
* Latency distributions
* Throughput
* Error rates
* Resource utilization
* Reliability scores
* Capacity estimates

### Failure Injection

The simulator can model infrastructure and application failures such as:

* Network partitions
* Service crashes
* Resource exhaustion
* Database contention
* Dependency failures
* Increased latency
* Availability degradation

### Growth Scenarios

Traffic growth can be modeled using scenarios such as:

* 2× traffic
* 5× traffic
* 10× traffic
* Linear growth
* Exponential growth

### Cost Modeling

The simulator estimates infrastructure costs across:

* Compute
* Storage
* Network traffic
* Databases
* Caches
* External APIs
* Other architecture components

### Deterministic Simulation

Simulation runs support deterministic seeds.

Using the same architecture, configuration, and seed produces reproducible simulation results, making it easier to compare architectural changes.

## Simulation Reports

Simulation results are stored as persistent reports.

Reports can contain:

* Executive summary
* Architecture/topology analysis
* Performance analysis
* Reliability analysis
* Scalability analysis
* Cost analysis
* Security analysis
* Failure scenario results
* Optimization recommendations
* AI-generated insights

This allows users to compare simulation results across different versions of a system design.

## GitHub Integration

Resonance can connect to GitHub repositories to analyze existing applications.

The GitHub workflow includes:

1. Authenticate with GitHub
2. Select a repository
3. Import repository information
4. Analyze the application architecture
5. Identify services and dependencies
6. Generate a visual system representation
7. Modify the generated architecture
8. Run simulations against the design

This allows an existing software system to become the starting point for architecture experimentation.

## Team Collaboration

Teams can collaborate on system designs with role-based access.

Supported roles include:

* **Owner**
* **Admin**
* **Member**

Team members can be invited through email using SMTP.

Team functionality includes:

* Team creation
* Member management
* Email invitations
* Invitation acceptance
* Role-based permissions
* Shared designs
* Shared simulation history

## API

The backend exposes REST APIs for authentication, designs, simulations, teams, and integrations.

| Endpoint                      | Description                            |
| ----------------------------- | -------------------------------------- |
| `POST /auth/webhook`          | Synchronize Clerk users                |
| `GET /designs`                | List designs                           |
| `POST /designs`               | Create a design                        |
| `GET /designs/:id`            | Get a design                           |
| `PUT /designs/:id`            | Update a design                        |
| `DELETE /designs/:id`         | Delete a design                        |
| `POST /simulations`           | Queue a simulation                     |
| `GET /simulations/:id/stream` | Stream simulation progress through SSE |
| `GET /team`                   | Get team information                   |
| `POST /team`                  | Create a team                          |
| `POST /team/:id/invite`       | Send a team invitation                 |
| `POST /team/invite/accept`    | Accept a team invitation               |
| `GET /github/status`          | Get GitHub connection status           |
| `GET /github/repos`           | List GitHub repositories               |

## Application Pages

| Page          | Route                    | Description                                 |
| ------------- | ------------------------ | ------------------------------------------- |
| Login         | `/login`                 | Clerk authentication                        |
| Dashboard     | `/dashboard`             | Designs, statistics, and project management |
| Canvas Editor | `/design/:id`            | Visual architecture editor and simulation   |
| Team          | `/team`                  | Team and member management                  |
| Invite Accept | `/team/invite?token=...` | Accept team invitations                     |
| Settings      | `/settings`              | Account and application settings            |
| Reports       | `/reports`               | Simulation report history                   |
| Templates     | `/templates`             | Pre-built architecture templates            |

## Canvas Editor

The Canvas Editor is the core interface of Resonance.

Users can:

* Drag architecture blocks onto the canvas
* Connect services using React Flow
* Configure individual components
* Define traffic and resource parameters
* Modify system topology
* Run simulations
* Monitor live simulation metrics
* Inspect simulation results
* Generate optimization recommendations
* Export architecture configurations

## Architecture Blocks

The simulator supports common distributed-system components including:

* Client
* API Gateway
* Service
* Database
* Cache
* Message Queue
* Load Balancer
* CDN
* External API
* Storage

Additional block types can be introduced as the simulator evolves.

## Docker

Docker Compose is provided for local infrastructure services.

Start the development infrastructure:

```bash
docker-compose up -d
```

This starts:

* PostgreSQL on port `5432`
* Redis on port `6379`

Production Docker configurations are also provided for deployment of the application services.

## Production Build

Build the project:

```bash
npm run build
```

Build the backend:

```bash
cd apps/api
npm run build
```

Build the frontend:

```bash
cd apps/web
npm run build
```

For production deployments, ensure that all required environment variables, database migrations, Redis connectivity, authentication configuration, SMTP credentials, and AI API credentials are configured.

## Development Roadmap

| Phase                             | Timeline     | Features                                                                                |
| --------------------------------- | ------------ | --------------------------------------------------------------------------------------- |
| **Phase 1 — MVP**                 | Months 1–3   | Visual canvas, architecture blocks, basic simulation, GitHub integration, Docker export |
| **Phase 2 — Advanced Simulation** | Months 4–6   | Full simulation engine, chaos testing, AI optimization, Kubernetes/Terraform export     |
| **Phase 3 — Collaboration**       | Months 7–9   | Real-time collaboration, CRDT, GitHub synchronization, architecture drift detection     |
| **Phase 4 — Ecosystem**           | Months 10–12 | Custom blocks, plugin system, marketplace, on-premise deployment                        |

## Vision

Resonance aims to make system design **visual, measurable, and interactive**.

Instead of designing an architecture and relying only on intuition, engineers can model a system, simulate realistic workloads and failures, analyze the results, and iterate on the architecture before deploying it.

> **Design it. Simulate it. Understand it. Optimize it.**

## License

MIT
