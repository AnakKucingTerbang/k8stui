export type ClusterStatus = "connected" | "degraded" | "unreachable"

export interface KubeContext {
  name: string
  cluster: string
  user: string
  server: string
}

export type MetricMode = "pct" | "raw"

export interface Cluster {
  contextName: string
  name: string
  status: ClusterStatus
  nodeOnline: number
  nodeTotal: number
  cpuPct: number
  memPct: number
  cpuRaw: string
  memRaw: string
  podsUsed: number
  podsTotal: number
  notes: string
}

export interface NodeDetail {
  name: string
  ready: boolean
  cpuPct: number
  memPct: number
  cpu: string
  mem: string
  age: string
  podsUsed: number
  podsTotal: number
  cpuAllocatable: number
  memAllocatable: number
}

export interface PodDetail {
  name: string
  namespace: string
  status: string
  cpu: string
  mem: string
  age: string
}

export interface PodContainer {
  name: string
  image: string
  command: string[]
  args: string[]
  ports: string[]
  cpuRequest: string
  cpuLimit: string
  memRequest: string
  memLimit: string
  livenessProbe: string
  readinessProbe: string
  env: { name: string; value: string }[]
  volumeMountNames: string[]
  pvcRefNames: string[]
  secretRefNames: string[]
  configMapRefNames: string[]
}

export interface DetailRow {
  key: string
  value: string
  isParent?: boolean
  indent?: boolean
}

export interface ApplicationResource {
  kind: string
  name: string
  namespace: string
  lastAppliedYaml: string
  summaryRows: DetailRow[]
}

export interface PodDetailFull {
  name: string
  namespace: string
  labels: string[]
  annotations: string[]
  created: string
  containers: PodContainer[]
  phase: string
  podIP: string
  hostIP: string
  restarts: number
  ready: boolean
  qosClass: string
  yaml: string
  appResources: ApplicationResource[]
  combinedOriginalYaml: string
  ownerKind: string
  ownerName: string
}
