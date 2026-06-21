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
}

export interface PodDetail {
  name: string
  namespace: string
  status: string
  cpu: string
  mem: string
  age: string
}
