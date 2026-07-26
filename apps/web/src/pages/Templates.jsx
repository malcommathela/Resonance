import React, { useState, useEffect, useMemo } from 'react'
import {
  Search,
  LayoutTemplate,
  Layers,
  Grid3X3,
  Cloud,
  Database,
  Shield,
  Network,
  Wifi,
  Clock,
  Puzzle,
  Zap,
  FileText,
  Smartphone,
  Bolt,
  Server,
  Container,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useThemeStore } from '@/stores/themeStore'

// --------------------------------------------------
// NovaFlow Elevation — gradient border shell
// --------------------------------------------------
const GRADIENT_SHELL =
  'p-[1px] rounded-[14px] bg-gradient-to-b from-[rgba(220,252,92,0.6)] via-[rgba(0,98,214,0.3)] to-[rgba(0,0,0,0.15)]'

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'app', label: 'Application' },
  { id: 'cloud', label: 'Cloud' },
  { id: 'data', label: 'Data' },
  { id: 'security', label: 'Security' },
  { id: 'network', label: 'Network' },
  { id: 'iot', label: 'IoT' },
]

const TEMPLATES = [
  {
    id: 'layered',
    category: 'app',
    title: 'Layered / N-Tier Architecture',
    description:
      'Presentation, application, domain, and infrastructure layers with clear separation of concerns. Ideal for enterprise applications.',
    badge: 'popular',
    icon: Layers,
    components: '4 Layers',
    setupTime: '5 min setup',
    preview: (
      <svg viewBox="0 0 280 80" className="w-full h-20">
        <rect x="20" y="5" width="240" height="18" rx="4" fill="#DCFC5C" opacity="0.9" />
        <text x="140" y="17" textAnchor="middle" fontSize="9" fontWeight="600" fill="#000">Presentation Layer (UI)</text>
        <rect x="20" y="28" width="240" height="18" rx="4" fill="#000" opacity="0.08" />
        <text x="140" y="40" textAnchor="middle" fontSize="9" fontWeight="500" fill="#374151">Application / Services</text>
        <rect x="20" y="51" width="240" height="18" rx="4" fill="#000" opacity="0.06" />
        <text x="140" y="63" textAnchor="middle" fontSize="9" fontWeight="500" fill="#6B7280">Domain + Infrastructure + Storage</text>
      </svg>
    ),
  },
  {
    id: 'microservices',
    category: 'app',
    title: 'Microservices Architecture',
    description:
      'Independent services with API gateway, service discovery, per-service databases, and async messaging via event bus.',
    badge: 'popular',
    icon: Grid3X3,
    components: '6 Components',
    setupTime: '12 min setup',
    preview: (
      <svg viewBox="0 0 280 80" className="w-full h-20">
        <rect x="110" y="2" width="60" height="14" rx="3" fill="#DCFC5C" />
        <text x="140" y="12" textAnchor="middle" fontSize="8" fontWeight="600" fill="#000">API Gateway</text>
        <line x1="125" y1="16" x2="60" y2="30" stroke="#9CA3AF" strokeWidth="1" />
        <line x1="140" y1="16" x2="140" y2="30" stroke="#9CA3AF" strokeWidth="1" />
        <line x1="155" y1="16" x2="220" y2="30" stroke="#9CA3AF" strokeWidth="1" />
        <rect x="30" y="30" width="60" height="16" rx="3" fill="#000" opacity="0.08" />
        <text x="60" y="41" textAnchor="middle" fontSize="7" fill="#374151">Service A</text>
        <rect x="110" y="30" width="60" height="16" rx="3" fill="#000" opacity="0.08" />
        <text x="140" y="41" textAnchor="middle" fontSize="7" fill="#374151">Service B</text>
        <rect x="190" y="30" width="60" height="16" rx="3" fill="#000" opacity="0.08" />
        <text x="220" y="41" textAnchor="middle" fontSize="7" fill="#374151">Service C</text>
        <rect x="100" y="55" width="80" height="12" rx="2" fill="#000" opacity="0.05" />
        <text x="140" y="64" textAnchor="middle" fontSize="7" fill="#6B7280">Message Broker / Event Bus</text>
      </svg>
    ),
  },
  {
    id: 'monolithic',
    category: 'app',
    title: 'Monolithic Application',
    description:
      'Single deployable unit with internal modules, shared data stores, and unified codebase. Perfect for MVPs and small teams.',
    badge: 'new',
    icon: LayoutTemplate,
    components: '3 Modules',
    setupTime: '3 min setup',
    preview: (
      <svg viewBox="0 0 280 80" className="w-full h-20">
        <rect x="40" y="8" width="200" height="55" rx="6" fill="#000" opacity="0.06" stroke="#000" strokeWidth="1" strokeOpacity="0.1" />
        <text x="140" y="22" textAnchor="middle" fontSize="9" fontWeight="600" fill="#374151">Monolithic App</text>
        <rect x="55" y="30" width="50" height="22" rx="3" fill="#DCFC5C" opacity="0.7" />
        <text x="80" y="44" textAnchor="middle" fontSize="7" fontWeight="500" fill="#000">Module A</text>
        <rect x="115" y="30" width="50" height="22" rx="3" fill="#DCFC5C" opacity="0.5" />
        <text x="140" y="44" textAnchor="middle" fontSize="7" fontWeight="500" fill="#000">Module B</text>
        <rect x="175" y="30" width="50" height="22" rx="3" fill="#DCFC5C" opacity="0.3" />
        <text x="200" y="44" textAnchor="middle" fontSize="7" fontWeight="500" fill="#000">Module C</text>
      </svg>
    ),
  },
  {
    id: 'cloud-infra',
    category: 'cloud',
    title: 'Cloud Infrastructure',
    description:
      'Load balancers, auto-scaling web/app servers, managed databases, caches, and message queues on AWS, Azure, or GCP.',
    badge: 'popular',
    icon: Cloud,
    components: '5 Components',
    setupTime: '10 min setup',
    preview: (
      <svg viewBox="0 0 280 80" className="w-full h-20">
        <rect x="100" y="2" width="80" height="14" rx="3" fill="#DCFC5C" />
        <text x="140" y="12" textAnchor="middle" fontSize="8" fontWeight="600" fill="#000">Load Balancer</text>
        <line x1="120" y1="16" x2="80" y2="30" stroke="#9CA3AF" strokeWidth="1" />
        <line x1="160" y1="16" x2="200" y2="30" stroke="#9CA3AF" strokeWidth="1" />
        <rect x="50" y="30" width="60" height="16" rx="3" fill="#000" opacity="0.08" />
        <text x="80" y="41" textAnchor="middle" fontSize="7" fill="#374151">Web Server</text>
        <rect x="170" y="30" width="60" height="16" rx="3" fill="#000" opacity="0.08" />
        <text x="200" y="41" textAnchor="middle" fontSize="7" fill="#374151">App Server</text>
        <rect x="70" y="55" width="60" height="14" rx="2" fill="#000" opacity="0.05" />
        <text x="100" y="65" textAnchor="middle" fontSize="7" fill="#6B7280">Database</text>
        <rect x="150" y="55" width="60" height="14" rx="2" fill="#000" opacity="0.05" />
        <text x="180" y="65" textAnchor="middle" fontSize="7" fill="#6B7280">Cache</text>
      </svg>
    ),
  },
  {
    id: 'network-topology',
    category: 'network',
    title: 'Network Topology',
    description:
      'VPCs, subnets, firewalls, routers, and VPN tunnels. On-premise to cloud connectivity with zero-trust segmentation.',
    badge: 'new',
    icon: Network,
    components: '7 Components',
    setupTime: '8 min setup',
    preview: (
      <svg viewBox="0 0 280 80" className="w-full h-20">
        <rect x="10" y="10" width="110" height="55" rx="4" fill="none" stroke="#000" strokeWidth="1" strokeOpacity="0.15" strokeDasharray="4 2" />
        <text x="65" y="22" textAnchor="middle" fontSize="8" fontWeight="600" fill="#374151">On-Premise</text>
        <rect x="20" y="30" width="35" height="14" rx="2" fill="#000" opacity="0.06" />
        <text x="37" y="40" textAnchor="middle" fontSize="6" fill="#6B7280">Router</text>
        <rect x="65" y="30" width="40" height="14" rx="2" fill="#000" opacity="0.06" />
        <text x="85" y="40" textAnchor="middle" fontSize="6" fill="#6B7280">Firewall</text>
        <rect x="160" y="10" width="110" height="55" rx="4" fill="none" stroke="#DCFC5C" strokeWidth="1.5" />
        <text x="215" y="22" textAnchor="middle" fontSize="8" fontWeight="600" fill="#374151">Cloud VPC</text>
        <rect x="170" y="30" width="40" height="14" rx="2" fill="#DCFC5C" opacity="0.5" />
        <text x="190" y="40" textAnchor="middle" fontSize="6" fontWeight="500" fill="#000">Subnet A</text>
        <rect x="220" y="30" width="40" height="14" rx="2" fill="#DCFC5C" opacity="0.3" />
        <text x="240" y="40" textAnchor="middle" fontSize="6" fontWeight="500" fill="#000">Subnet B</text>
        <line x1="120" y1="37" x2="160" y2="37" stroke="#9CA3AF" strokeWidth="1" />
        <text x="140" y="35" textAnchor="middle" fontSize="6" fill="#6B7280">VPN</text>
      </svg>
    ),
  },
  {
    id: 'data-pipeline',
    category: 'data',
    title: 'Data Pipeline & Analytics',
    description:
      'Sources → ETL/ELT → streaming processing → data lake/warehouse → BI tools. Real-time and batch pipelines.',
    badge: 'popular',
    icon: Database,
    components: '5 Stages',
    setupTime: '15 min setup',
    preview: (
      <svg viewBox="0 0 280 80" className="w-full h-20">
        <rect x="5" y="25" width="45" height="18" rx="3" fill="#000" opacity="0.08" />
        <text x="27" y="37" textAnchor="middle" fontSize="7" fill="#374151">Sources</text>
        <line x1="50" y1="34" x2="70" y2="34" stroke="#9CA3AF" strokeWidth="1" />
        <polygon points="68,32 72,34 68,36" fill="#9CA3AF" />
        <rect x="75" y="25" width="45" height="18" rx="3" fill="#DCFC5C" opacity="0.7" />
        <text x="97" y="37" textAnchor="middle" fontSize="7" fontWeight="500" fill="#000">ETL</text>
        <line x1="120" y1="34" x2="140" y2="34" stroke="#9CA3AF" strokeWidth="1" />
        <polygon points="138,32 142,34 138,36" fill="#9CA3AF" />
        <rect x="145" y="25" width="50" height="18" rx="3" fill="#000" opacity="0.06" />
        <text x="170" y="37" textAnchor="middle" fontSize="7" fill="#374151">Warehouse</text>
        <line x1="195" y1="34" x2="215" y2="34" stroke="#9CA3AF" strokeWidth="1" />
        <polygon points="213,32 217,34 213,36" fill="#9CA3AF" />
        <rect x="220" y="25" width="45" height="18" rx="3" fill="#000" opacity="0.08" />
        <text x="242" y="37" textAnchor="middle" fontSize="7" fill="#374151">BI Tools</text>
      </svg>
    ),
  },
  {
    id: 'security-arch',
    category: 'security',
    title: 'Security Architecture',
    description:
      'Auth, IAM, WAF, VPN, zero-trust components, and monitoring. Defense-in-depth with SIEM and threat detection.',
    badge: 'new',
    icon: Shield,
    components: '6 Layers',
    setupTime: '10 min setup',
    preview: (
      <svg viewBox="0 0 280 80" className="w-full h-20">
        <rect x="20" y="5" width="240" height="55" rx="4" fill="none" stroke="#000" strokeWidth="1" strokeOpacity="0.1" />
        <rect x="30" y="12" width="50" height="18" rx="3" fill="#DCFC5C" opacity="0.6" />
        <text x="55" y="24" textAnchor="middle" fontSize="7" fontWeight="500" fill="#000">Auth / IAM</text>
        <rect x="90" y="12" width="50" height="18" rx="3" fill="#000" opacity="0.06" />
        <text x="115" y="24" textAnchor="middle" fontSize="7" fill="#374151">WAF</text>
        <rect x="150" y="12" width="50" height="18" rx="3" fill="#000" opacity="0.06" />
        <text x="175" y="24" textAnchor="middle" fontSize="7" fill="#374151">VPN</text>
        <rect x="210" y="12" width="40" height="18" rx="3" fill="#000" opacity="0.06" />
        <text x="230" y="24" textAnchor="middle" fontSize="7" fill="#374151">SIEM</text>
        <rect x="80" y="38" width="120" height="16" rx="3" fill="#000" opacity="0.04" />
        <text x="140" y="49" textAnchor="middle" fontSize="8" fontWeight="600" fill="#6B7280">Zero-Trust Perimeter</text>
      </svg>
    ),
  },
  {
    id: 'integration-api',
    category: 'app',
    title: 'Integration & API Architecture',
    description:
      'API gateway, backend-for-frontend pattern, external SaaS connectors, and third-party API orchestration with rate limiting.',
    badge: null,
    icon: Puzzle,
    components: '4 Components',
    setupTime: '7 min setup',
    preview: (
      <svg viewBox="0 0 280 80" className="w-full h-20">
        <rect x="100" y="2" width="80" height="14" rx="3" fill="#DCFC5C" />
        <text x="140" y="12" textAnchor="middle" fontSize="8" fontWeight="600" fill="#000">API Gateway</text>
        <line x1="110" y1="16" x2="60" y2="32" stroke="#9CA3AF" strokeWidth="1" />
        <line x1="140" y1="16" x2="140" y2="32" stroke="#9CA3AF" strokeWidth="1" />
        <line x1="170" y1="16" x2="220" y2="32" stroke="#9CA3AF" strokeWidth="1" />
        <rect x="30" y="32" width="60" height="16" rx="3" fill="#000" opacity="0.08" />
        <text x="60" y="43" textAnchor="middle" fontSize="7" fill="#374151">Backend A</text>
        <rect x="110" y="32" width="60" height="16" rx="3" fill="#000" opacity="0.08" />
        <text x="140" y="43" textAnchor="middle" fontSize="7" fill="#374151">Backend B</text>
        <rect x="190" y="32" width="60" height="16" rx="3" fill="#000" opacity="0.06" />
        <text x="220" y="43" textAnchor="middle" fontSize="7" fill="#374151">SaaS API</text>
        <rect x="90" y="55" width="100" height="12" rx="2" fill="#000" opacity="0.04" />
        <text x="140" y="64" textAnchor="middle" fontSize="7" fill="#6B7280">Rate Limiter / Cache</text>
      </svg>
    ),
  },
  {
    id: 'iot',
    category: 'iot',
    title: 'IoT System Architecture',
    description:
      'Devices, edge gateways, cloud ingestion, stream processing, time-series storage, and real-time dashboards.',
    badge: 'new',
    icon: Wifi,
    components: '5 Layers',
    setupTime: '12 min setup',
    preview: (
      <svg viewBox="0 0 280 80" className="w-full h-20">
        <rect x="5" y="20" width="35" height="20" rx="3" fill="#000" opacity="0.08" />
        <text x="22" y="33" textAnchor="middle" fontSize="6" fill="#374151">Device</text>
        <rect x="45" y="20" width="35" height="20" rx="3" fill="#000" opacity="0.08" />
        <text x="62" y="33" textAnchor="middle" fontSize="6" fill="#374151">Device</text>
        <line x1="80" y1="30" x2="100" y2="30" stroke="#9CA3AF" strokeWidth="1" />
        <rect x="100" y="18" width="55" height="24" rx="3" fill="#DCFC5C" opacity="0.6" />
        <text x="127" y="33" textAnchor="middle" fontSize="7" fontWeight="500" fill="#000">Edge Gateway</text>
        <line x1="155" y1="30" x2="175" y2="30" stroke="#9CA3AF" strokeWidth="1" />
        <rect x="175" y="18" width="55" height="24" rx="3" fill="#000" opacity="0.06" />
        <text x="202" y="30" textAnchor="middle" fontSize="7" fill="#374151">Cloud</text>
        <text x="202" y="38" textAnchor="middle" fontSize="6" fill="#6B7280">Ingestion</text>
        <rect x="235" y="20" width="35" height="20" rx="3" fill="#000" opacity="0.05" />
        <text x="252" y="33" textAnchor="middle" fontSize="6" fill="#6B7280">Dash</text>
      </svg>
    ),
  },
  {
    id: 'mobile-web',
    category: 'app',
    title: 'Mobile & Web App Architecture',
    description:
      'Front-end clients, backend APIs, auth service, push notifications, CDN, and app store distribution pipelines.',
    badge: 'popular',
    icon: Smartphone,
    components: '6 Components',
    setupTime: '8 min setup',
    preview: (
      <svg viewBox="0 0 280 80" className="w-full h-20">
        <rect x="10" y="10" width="55" height="22" rx="3" fill="#000" opacity="0.08" />
        <text x="37" y="22" textAnchor="middle" fontSize="7" fill="#374151">Web App</text>
        <text x="37" y="29" textAnchor="middle" fontSize="6" fill="#6B7280">React/Vue</text>
        <rect x="10" y="40" width="55" height="22" rx="3" fill="#000" opacity="0.08" />
        <text x="37" y="52" textAnchor="middle" fontSize="7" fill="#374151">Mobile</text>
        <text x="37" y="59" textAnchor="middle" fontSize="6" fill="#6B7280">iOS/Android</text>
        <line x1="65" y1="21" x2="100" y2="21" stroke="#9CA3AF" strokeWidth="1" />
        <line x1="65" y1="51" x2="100" y2="51" stroke="#9CA3AF" strokeWidth="1" />
        <rect x="100" y="5" width="80" height="28" rx="3" fill="#DCFC5C" opacity="0.7" />
        <text x="140" y="18" textAnchor="middle" fontSize="8" fontWeight="500" fill="#000">Backend API</text>
        <text x="140" y="27" textAnchor="middle" fontSize="6" fill="#374151">REST / GraphQL</text>
        <rect x="100" y="40" width="80" height="28" rx="3" fill="#000" opacity="0.06" />
        <text x="140" y="53" textAnchor="middle" fontSize="7" fill="#374151">Auth + Push</text>
        <text x="140" y="62" textAnchor="middle" fontSize="6" fill="#6B7280">Notifications</text>
        <line x1="180" y1="19" x2="215" y2="19" stroke="#9CA3AF" strokeWidth="1" />
        <line x1="180" y1="54" x2="215" y2="54" stroke="#9CA3AF" strokeWidth="1" />
        <rect x="215" y="10" width="50" height="22" rx="3" fill="#000" opacity="0.05" />
        <text x="240" y="24" textAnchor="middle" fontSize="6" fill="#6B7280">Database</text>
      </svg>
    ),
  },
  {
    id: 'event-driven',
    category: 'app',
    title: 'Event-Driven Architecture',
    description:
      'Event producers, event bus, consumers, CQRS, and sagas. Asynchronous communication with eventual consistency.',
    badge: null,
    icon: Bolt,
    components: '4 Patterns',
    setupTime: '10 min setup',
    preview: (
      <svg viewBox="0 0 280 80" className="w-full h-20">
        <rect x="10" y="25" width="55" height="20" rx="3" fill="#000" opacity="0.08" />
        <text x="37" y="38" textAnchor="middle" fontSize="7" fill="#374151">Producer</text>
        <line x1="65" y1="35" x2="95" y2="35" stroke="#9CA3AF" strokeWidth="1" />
        <polygon points="93,33 97,35 93,37" fill="#9CA3AF" />
        <rect x="95" y="20" width="90" height="30" rx="4" fill="#DCFC5C" opacity="0.5" />
        <text x="140" y="35" textAnchor="middle" fontSize="8" fontWeight="600" fill="#000">Event Bus</text>
        <text x="140" y="44" textAnchor="middle" fontSize="6" fill="#374151">Kafka / RabbitMQ</text>
        <line x1="185" y1="28" x2="215" y2="20" stroke="#9CA3AF" strokeWidth="1" />
        <line x1="185" y1="42" x2="215" y2="50" stroke="#9CA3AF" strokeWidth="1" />
        <rect x="215" y="10" width="50" height="18" rx="3" fill="#000" opacity="0.06" />
        <text x="240" y="22" textAnchor="middle" fontSize="7" fill="#374151">Consumer A</text>
        <rect x="215" y="45" width="50" height="18" rx="3" fill="#000" opacity="0.06" />
        <text x="240" y="57" textAnchor="middle" fontSize="7" fill="#374151">Consumer B</text>
      </svg>
    ),
  },
  {
    id: 'serverless',
    category: 'cloud',
    title: 'Serverless Architecture',
    description:
      'Functions-as-a-Service, managed API gateway, event triggers, and NoSQL databases. Pay-per-execution model.',
    badge: 'new',
    icon: Zap,
    components: '4 Layers',
    setupTime: '6 min setup',
    preview: (
      <svg viewBox="0 0 280 80" className="w-full h-20">
        <rect x="90" y="2" width="100" height="14" rx="3" fill="#DCFC5C" />
        <text x="140" y="12" textAnchor="middle" fontSize="8" fontWeight="600" fill="#000">API Gateway</text>
        <line x1="115" y1="16" x2="70" y2="30" stroke="#9CA3AF" strokeWidth="1" />
        <line x1="140" y1="16" x2="140" y2="30" stroke="#9CA3AF" strokeWidth="1" />
        <line x1="165" y1="16" x2="210" y2="30" stroke="#9CA3AF" strokeWidth="1" />
        <rect x="40" y="30" width="60" height="16" rx="3" fill="#000" opacity="0.08" />
        <text x="70" y="41" textAnchor="middle" fontSize="7" fill="#374151">Function A</text>
        <rect x="110" y="30" width="60" height="16" rx="3" fill="#000" opacity="0.08" />
        <text x="140" y="41" textAnchor="middle" fontSize="7" fill="#374151">Function B</text>
        <rect x="180" y="30" width="60" height="16" rx="3" fill="#000" opacity="0.08" />
        <text x="210" y="41" textAnchor="middle" fontSize="7" fill="#374151">Function C</text>
        <rect x="100" y="55" width="80" height="12" rx="2" fill="#000" opacity="0.05" />
        <text x="140" y="64" textAnchor="middle" fontSize="7" fill="#6B7280">DynamoDB / Firestore</text>
      </svg>
    ),
  },
  {
    id: 'kubernetes',
    category: 'cloud',
    title: 'Kubernetes & Container Architecture',
    description:
      'Container registry, K8s cluster with pods, services, ingress, ConfigMaps, and persistent volumes.',
    badge: 'popular',
    icon: Container,
    components: '6 Resources',
    setupTime: '15 min setup',
    preview: (
      <svg viewBox="0 0 280 80" className="w-full h-20">
        <rect x="20" y="5" width="240" height="55" rx="4" fill="none" stroke="#000" strokeWidth="1" strokeOpacity="0.1" />
        <text x="140" y="16" textAnchor="middle" fontSize="8" fontWeight="600" fill="#374151">Kubernetes Cluster</text>
        <rect x="35" y="22" width="55" height="16" rx="3" fill="#DCFC5C" opacity="0.5" />
        <text x="62" y="33" textAnchor="middle" fontSize="7" fontWeight="500" fill="#000">Pod A</text>
        <rect x="100" y="22" width="55" height="16" rx="3" fill="#DCFC5C" opacity="0.4" />
        <text x="127" y="33" textAnchor="middle" fontSize="7" fontWeight="500" fill="#000">Pod B</text>
        <rect x="165" y="22" width="55" height="16" rx="3" fill="#DCFC5C" opacity="0.3" />
        <text x="192" y="33" textAnchor="middle" fontSize="7" fontWeight="500" fill="#000">Pod C</text>
        <rect x="80" y="42" width="60" height="14" rx="2" fill="#000" opacity="0.05" />
        <text x="110" y="52" textAnchor="middle" fontSize="7" fill="#6B7280">Service</text>
        <rect x="150" y="42" width="60" height="14" rx="2" fill="#000" opacity="0.05" />
        <text x="180" y="52" textAnchor="middle" fontSize="7" fill="#6B7280">Ingress</text>
      </svg>
    ),
  },
]

// --------------------------------------------------
// Skeletons (inline so page is self-contained until skeletons.jsx is updated)
// --------------------------------------------------
const ShimmerBar = ({ className = '', style = {} }) => (
  <div
    className={`skeleton-shimmer rounded-xl ${className}`}
    style={{
      background: 'linear-gradient(90deg, rgb(var(--bg-tertiary-rgb)) 25%, rgb(var(--bg-hover-rgb)) 50%, rgb(var(--bg-tertiary-rgb)) 75%)',
      backgroundSize: '200% 100%',
      animation: 'skeleton-shimmer 1.5s ease-in-out infinite',
      ...style,
    }}
  />
)

function TemplateCardSkeleton() {
  return (
    <div className={GRADIENT_SHELL}>
      <div className="bg-resonance-bg-secondary rounded-[13px] p-6 h-full flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <ShimmerBar className="h-11 w-11 rounded-xl" />
          <ShimmerBar className="h-5 w-16 rounded-full" />
        </div>
        <ShimmerBar className="h-5 w-3/4" />
        <ShimmerBar className="h-3 w-full" />
        <ShimmerBar className="h-3 w-5/6" />
        <ShimmerBar className="h-20 w-full rounded-lg" />
        <div className="flex gap-4 pt-3 border-t border-resonance-border">
          <ShimmerBar className="h-3 w-20" />
          <ShimmerBar className="h-3 w-20" />
        </div>
      </div>
    </div>
  )
}

function TemplatesPageSkeleton() {
  return (
    <div className="max-w-[1200px] mx-auto px-6 lg:px-12 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <ShimmerBar className="h-6 w-48 mx-auto rounded-full" />
        <ShimmerBar className="h-9 w-72 mx-auto" />
        <ShimmerBar className="h-4 w-96 mx-auto" />
        <div className="flex justify-center gap-3 pt-2">
          <ShimmerBar className="h-10 w-36 rounded-xl" />
          <ShimmerBar className="h-10 w-32 rounded-xl" />
        </div>
      </div>

      {/* Search */}
      <ShimmerBar className="h-12 w-full max-w-xl mx-auto rounded-xl" />

      {/* Filters */}
      <div className="flex justify-center gap-2 flex-wrap">
        {[...Array(7)].map((_, i) => (
          <ShimmerBar key={i} className="h-9 w-24 rounded-full" />
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {[...Array(6)].map((_, i) => (
          <TemplateCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

// --------------------------------------------------
// Main Page
// --------------------------------------------------
export const Templates = () => {
  const [activeFilter, setActiveFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  // Initialize theme on mount (same pattern as other pages)
  const { init: initTheme } = useThemeStore()
  useEffect(() => {
    initTheme()
    // Simulate loading for demo / until API is wired
    const timer = setTimeout(() => setLoading(false), 800)
    return () => clearTimeout(timer)
  }, [initTheme])

  const filteredTemplates = useMemo(() => {
    return TEMPLATES.filter((t) => {
      const matchesCategory = activeFilter === 'all' || t.category === activeFilter
      const q = searchQuery.toLowerCase()
      const matchesSearch =
        t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
      return matchesCategory && matchesSearch
    })
  }, [activeFilter, searchQuery])

  if (loading) {
    return <TemplatesPageSkeleton />
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 lg:px-12 py-8 space-y-8">
      {/* Hero */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-resonance-bg-tertiary px-4 py-1.5 rounded-full text-sm font-medium text-resonance-text-primary">
          <span className="w-2 h-2 rounded-full bg-resonance-accent animate-pulse" />
          {TEMPLATES.length} Architecture Patterns Available
        </div>
        <h1 className="text-3xl font-semibold leading-9 tracking-tight text-resonance-text-primary">
          Architecture Templates for Every System
        </h1>
        <p className="text-base text-resonance-text-secondary leading-relaxed">
          Production-ready architecture diagrams and templates. From monoliths to microservices,
          cloud infrastructure to IoT — design, document, and deploy with confidence.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button icon={LayoutTemplate}>Browse Templates</Button>
          <Button variant="ghost" className="text-resonance-text-secondary hover:text-resonance-text-primary">
            View Documentation →
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-xl mx-auto">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-resonance-text-muted pointer-events-none"
        />
        <Input
          type="text"
          placeholder="Search templates (e.g., microservices, AWS, Kubernetes)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-11 h-12 rounded-xl bg-resonance-bg-secondary border-resonance-border text-resonance-text-primary placeholder:text-resonance-text-muted focus:border-resonance-accent focus:ring-1 focus:ring-resonance-accent"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap justify-center gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveFilter(cat.id)}
            className={`px-4 py-2 rounded-full text-[13px] font-medium border transition-all duration-150 ${
              activeFilter === cat.id
                ? 'bg-resonance-neutral text-resonance-accent border-resonance-neutral'
                : 'bg-transparent text-resonance-text-tertiary border-resonance-border hover:border-resonance-text-primary hover:text-resonance-text-primary'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredTemplates.map((template) => {
          const Icon = template.icon
          return (
            <div
              key={template.id}
              className={`${GRADIENT_SHELL} transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(0,0,0,0.1)]`}
            >
              <div className="bg-resonance-bg-secondary rounded-[13px] p-6 h-full flex flex-col gap-4 cursor-pointer transition-colors duration-150 hover:bg-resonance-bg-primary">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="w-11 h-11 rounded-xl bg-resonance-accent flex items-center justify-center shrink-0">
                    <Icon size={22} className="text-resonance-neutral" />
                  </div>
                  {template.badge && (
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                        template.badge === 'popular'
                          ? 'bg-resonance-accent/40 text-resonance-neutral'
                          : 'bg-resonance-bg-tertiary text-resonance-text-primary'
                      }`}
                    >
                      {template.badge}
                    </span>
                  )}
                </div>

                {/* Title */}
                <h3 className="text-base font-semibold leading-snug text-resonance-text-primary">
                  {template.title}
                </h3>

                {/* Description */}
                <p className="text-[13px] leading-5 text-resonance-text-secondary flex-grow">
                  {template.description}
                </p>

                {/* Preview */}
                <div className="text-resonance-text-primary">{template.preview}</div>

                {/* Meta */}
                <div className="flex gap-4 pt-3 border-t border-resonance-border">
                  <span className="flex items-center gap-1.5 text-xs text-resonance-text-tertiary font-medium">
                    <FileText size={14} />
                    {template.components}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-resonance-text-tertiary font-medium">
                    <Clock size={14} />
                    {template.setupTime}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-resonance-bg-tertiary flex items-center justify-center mx-auto mb-4">
            <Search size={28} className="text-resonance-text-muted" />
          </div>
          <h3 className="text-lg font-semibold text-resonance-text-primary mb-1">
            No templates found
          </h3>
          <p className="text-sm text-resonance-text-secondary">
            Try adjusting your search or filter to find what you're looking for.
          </p>
        </div>
      )}
    </div>
  )
}