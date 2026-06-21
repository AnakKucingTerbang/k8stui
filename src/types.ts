export type ClusterStatus = "connected" | "degraded" | "unreachable"

export interface KubeContext {
  name: string
  cluster: string
  user: string
  server: string
}

export interface Cluster {
  contextName: string
  name: string
  status: ClusterStatus
  nodeOnline: number
  nodeTotal: number
  cpuPct: number
  memPct: number
  podsUsed: number
  podsTotal: number
  notes: string
}
